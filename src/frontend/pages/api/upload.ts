import * as Formidable from 'formidable';
import fs from "fs";
import path from "node:path";
import MongoApi from "../../api/MongoApi";
import {IImage} from "../../gqty";
import guid from "../../../helpers/guid";
import PersistentFile from "formidable/PersistentFile";

export const config = {
    api: {
        bodyParser: false
    }
};

const mongoApi = new MongoApi()

const uploadForm = (next: { (req: any, res: any): void; (arg0: any, arg1: any): unknown; }) => (req: any, res: any) => {
    return new Promise(async (resolve, reject) => {
        try {
            const form = new Formidable.IncomingForm({
                multiples: false,
                keepExtensions: true,
                uploadDir: path.join(process.cwd(), 'src/frontend/', `public/temp/`)
            });

            form.once("error", console.error);
            form
                .on("fileBegin", (fields: any, files: any) => {
                    console.log("start uploading: ", fields, files.originalFilename);
                })
                .on("aborted", () => console.log("Aborted..."));
            form.once("end", () => {
                console.log("Done!");
            });
            form.parse(req, async (err: any, fields: any, files: any) => {

                if (err) {
                    throw String(JSON.stringify(err, null, 2));
                }
                const file = files.file[0]

                const existingFile = fs.existsSync(`src/frontend/public/images/${file.originalFilename}`);
                if(!existingFile){
                    fs.renameSync(file.filepath, path.join(process.cwd(), 'src/frontend/', `public/images/${file.originalFilename}`));
                    const image: IImage = {
                        created: new Date().toDateString(),
                        id: guid(),
                        location: `images/${file.originalFilename}`,
                        name: file.originalFilename,
                        size: file.size,
                        type: file.mimetype,
                        tags: JSON.parse(fields.tags)
                    }
                    console.log('saving:',image)
                    await mongoApi.saveImage(image)
                    req.form = {fields, files};
                    return resolve(next(req, res));
                }else{
                    fs.unlinkSync(file.filepath);
                    return resolve(res.status(200).send(JSON.stringify({'error': "Image already exists, please select it from existing Images"})));
                }

            });
        } catch (error) {
            console.log(error)
            return resolve(res.status(403).send(error));
        }
    });
};

function handler(req: any, res: any) {
    try {
        if (req.method === "POST") {
            res.status(200).send(req.form);
        } else {
            throw String("Method not allowed");
        }
    } catch (error) {
        res.status(400).json({message: JSON.stringify(error, null, 2)});
    }
}

export default uploadForm(handler);
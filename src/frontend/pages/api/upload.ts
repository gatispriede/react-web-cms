import * as Formidable from 'formidable';
import fs from "fs";
import path from "node:path";
import MongoApi from "../../api/MongoApi";
import guid from "../../../helpers/guid";
import {PUBLIC_IMAGE_PATH} from "../../../constants/imgPath";
import IImage, {InImage} from "../../../Interfaces/IImage";

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
                    console.warn("start uploading: ", fields, files.originalFilename);
                })
                .on("aborted", () => console.error("Aborted..."));
            form.once("end", () => {
                console.warn("Done!");
            });
            form.parse(req, async (err: any, fields: any, files: any) => {

                if (err) {
                    throw String(JSON.stringify(err, null, 2));
                }
                const file = files.file[0]
                const fileTargetName = file.originalFilename.replace(' ','_')
                const existingFile = fs.existsSync(`src/frontend/public/images/${file.originalFilename}`);
                if(!existingFile){
                    fs.renameSync(file.filepath, path.join(process.cwd(), 'src/frontend/', `public/images/${fileTargetName}`));
                    const image: InImage = {
                        created: new Date().toDateString(),
                        id: guid(),
                        location: `${PUBLIC_IMAGE_PATH}${fileTargetName}`,
                        name: fileTargetName,
                        size: file.size,
                        type: file.mimetype,
                        tags: JSON.parse(fields.tags)
                    }
                    await mongoApi.saveImage(image)
                    req.form = {fields, files};
                    return resolve(next(req, res));
                }else{
                    fs.unlinkSync(file.filepath);
                    return resolve(res.status(200).send(JSON.stringify({'error': "Image already exists, please select it from existing Images"})));
                }

            });
        } catch (error) {
            console.error(error)
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
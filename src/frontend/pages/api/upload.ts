import * as Formidable from 'formidable';
import fs from "fs";
import path from "node:path";

export const config = {
    api: {
        bodyParser: false
    }
};

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
                    console.log("start uploading: ", files.originalFilename);
                })
                .on("aborted", () => console.log("Aborted..."));
            form.once("end", () => {
                console.log("Done!");
            });
            form.parse(req, async (err: any, fields: any, files: any) => {

                if (err) {
                    throw String(JSON.stringify(err, null, 2));
                }

                fs.renameSync(files.file[0].filepath, path.join(process.cwd(), 'src/frontend/', `public/images/${files.file[0].originalFilename}`));
                req.form = {fields, files};
                return resolve(next(req, res));
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
import * as Formidable from 'formidable';
import fs from "fs";
import path from "node:path";
import guid from "@utils/guid";
import {PUBLIC_IMAGE_PATH} from "@utils/imgPath";
import {InImage} from "@interfaces/IImage";
import {getMongoConnection} from "@services/infra/mongoDBConnection";
import {ROLE_RANK, sessionFromReq} from "@services/features/Auth/authz";
import {authOptions} from "./auth/authOptions";

export const config = {
    api: {
        bodyParser: false
    }
};

const uploadForm = (next: { (req: any, res: any): void; (arg0: any, arg1: any): unknown; }) => (req: any, res: any) => {
    return new Promise(async (resolve) => {
        try {
            const session = await sessionFromReq(req, res, authOptions);
            if (ROLE_RANK[session.role] < ROLE_RANK.editor) {
                return resolve(res.status(403).json({error: 'editor role required'}));
            }
            const uploadDir = path.join(process.cwd(), 'ui/client/', 'public/temp/');
            // Ensure temp dir exists — it isn't checked in, and next build
            // doesn't create it. Missing dir → formidable ENOENTs async and
            // the upload hangs at 100% client-side.
            fs.mkdirSync(uploadDir, {recursive: true});
            const form = new Formidable.IncomingForm({
                multiples: false,
                keepExtensions: true,
                uploadDir,
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
                const existingFile = fs.existsSync(`ui/client/public/images/${fileTargetName}`);
                if(!existingFile){
                    // copy+unlink instead of rename — `public/temp` is on the
                    // container overlay fs while `public/images` is bind-mounted
                    // from the host, so renameSync fails with EXDEV.
                    const dest = path.join(process.cwd(), 'ui/client/', `public/images/${fileTargetName}`);
                    fs.copyFileSync(file.filepath, dest);
                    fs.unlinkSync(file.filepath);
                    const rawTags = (() => {
                        try { return JSON.parse(fields.tags) } catch { return [] }
                    })();
                    const tags = Array.isArray(rawTags) ? rawTags.filter(Boolean) : [];
                    const withAll = tags.includes('All') ? tags : ['All', ...tags];
                    const image: InImage = {
                        created: new Date().toDateString(),
                        id: guid(),
                        location: `${PUBLIC_IMAGE_PATH}${fileTargetName}`,
                        name: fileTargetName,
                        size: file.size,
                        type: file.mimetype,
                        tags: withAll
                    }
                    // Call the service directly — going through the frontend
                    // gqty client from an API route doesn't forward the caller's
                    // session cookie, so authz would reject it as 'viewer'.
                    await getMongoConnection().assetService.saveImage(image);
                    req.form = {fields, files, image};
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

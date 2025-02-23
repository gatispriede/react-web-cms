import fs from 'fs'; // Streaming module for reading

const MEDIA_ROOT_PATH = `${process.cwd()}/src/frontend/public/`;

export const config = {
    api: {
        bodyParser: false
    }
};
const handleImages = (next: {
    (req: any, res: any): void;
    (arg0: any, arg1: any): unknown;
}) => (req: any, res: any) => {
    return new Promise(async (resolve, reject) => {
        const responseHeader = new Headers();
        const fileName = req.url.replace('\/api\/','')
        const tmp = fileName.split('.')
        const fileType = tmp[tmp.length]
        responseHeader.set('Content-Type', 'api/' + fileType);

        try {
            const stream = fs.readFileSync(MEDIA_ROOT_PATH + 'images/' + fileName);
            resolve(res
                .status(200)
                .setHeader("Content-Type", responseHeader)
                .setHeader("Content-Length", stream.length)
                .send(stream))
        } catch (error) {
            return resolve(res.status(500).send({message: "Error fetching the document", error}));
        }
        return resolve(res.status(200).send(JSON.stringify({'error': "Image already exists, please select it from existing Images"})));
    }).catch(() => {
        return res.status(404).send({message: "Image not found"});
    })
}

function handler(req: any, res: any) {
    try {
        if (req.method === "GET") {
            return res.status(200).send(req.form);
        } else {
            throw String("Method not allowed");
        }
    } catch (error) {
        return res.status(400).json({message: JSON.stringify(error, null, 2)});
    }
}

export default handleImages(handler);
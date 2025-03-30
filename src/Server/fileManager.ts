import fs from "fs";

const LOCALE_ROOT_PATH = `${process.cwd()}/src/frontend/public/locales`;

class FileManager {
    publicFolderPath: string = LOCALE_ROOT_PATH

    saveTranslation(name: string, translation: JSON) {
        const langPath = this.publicFolderPath + '/' + name;
        const fileName = langPath + '/app.json'
        // folder creation
        if (!fs.existsSync(langPath)) {
            fs.mkdirSync(langPath, {recursive: true});
        }
        // save file
        fs.writeFileSync(fileName, JSON.stringify(translation));
    }
    deleteTranslation(name: string) {
        const langPath = this.publicFolderPath + '/' + name;
        const fileName = langPath + '/app.json'
        // folder creation
        if (!fs.existsSync(langPath)) {
            fs.mkdirSync(langPath, {recursive: true});
        }
        // save file
        return fs.unlink(fileName,(err) => {
            if (err) throw err;
            console.log(`${fileName} was deleted`);
            // fs.rmSync(langPath, { recursive: true, force: true });
        });
    }

}

export default FileManager
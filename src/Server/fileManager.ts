import fs from "fs";

const LOCALE_ROOT_PATH = `${process.cwd()}/src/frontend/public/locales`;

class FileManager {
    publicFolderPath: string = LOCALE_ROOT_PATH

    /** Read the current on-disk translations for a locale, or `{}` if missing. */
    readTranslation(name: string): Record<string, string> {
        const fileName = `${this.publicFolderPath}/${name}/app.json`;
        try {
            if (!fs.existsSync(fileName)) return {};
            const raw = fs.readFileSync(fileName, 'utf8');
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (err) {
            console.error(`[fileManager] failed to read ${fileName}:`, err);
            return {};
        }
    }

    saveTranslation(name: string, translation: JSON | Record<string, string>) {
        const langPath = this.publicFolderPath + '/' + name;
        const fileName = langPath + '/app.json'
        if (!fs.existsSync(langPath)) {
            fs.mkdirSync(langPath, {recursive: true});
        }
        fs.writeFileSync(fileName, JSON.stringify(translation));
    }

    deleteTranslation(name: string) {
        const langPath = this.publicFolderPath + '/' + name;
        const fileName = langPath + '/app.json'
        if (!fs.existsSync(langPath)) {
            fs.mkdirSync(langPath, {recursive: true});
        }
        fs.writeFileSync(fileName, JSON.stringify({}));
    }

}

export default FileManager
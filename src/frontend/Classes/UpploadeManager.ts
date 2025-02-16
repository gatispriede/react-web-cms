import {
    Blur,
    Brightness,
    Contrast,
    Crop,
    en,
    Grayscale,
    HueRotate,
    Invert,
    Local,
    Saturate,
    Sepia,
    Uppload
} from "uppload";
import "uppload/dist/uppload.css";
import "uppload/dist/themes/light.css";

class UpploadManager {
    private readonly _previewRef: HTMLImageElement;
    private readonly _buttonRef: HTMLButtonElement;

    private readonly _defaultImgUrl: string = "https://images.pexels.com/photos/1525041/pexels-photo-1525041.jpeg?auto=compress&cs=tinysrgb&w=600"

    private readonly _setFile: (file: File) => void;

    public fileName: string = ''
    public file: any = undefined

    constructor(previewRef: HTMLImageElement, buttonRef: HTMLButtonElement, setFile: (file: File) => void) {
        this._previewRef = previewRef
        this._buttonRef = buttonRef
        this._setFile = setFile
        this.setup()
    }
    setup() {
        const uploader = new Uppload({
            lang: en,
            bind: this._previewRef,
            call: this._buttonRef,
            value: this._defaultImgUrl,
            uploader: async (file, updateProgress) => {
                return new Promise(resolve => {
                    const resultFile = file as File
                    try {
                        this.fileName = resultFile.name
                        this.file = resultFile
                        this._setFile(resultFile)
                        setTimeout(() => resolve(window.URL.createObjectURL(file)), 2750);

                        let progress = 0;
                        const interval = setInterval(() => {
                            if (progress > 99) clearInterval(interval);
                            if (updateProgress) updateProgress(progress++);
                        }, 25);
                        const formData = new FormData()
                        formData.append('file', file)

                        fetch('/api/upload', {
                            method: 'POST',
                            // headers: {
                            //   "Content-Type": "multipart/form-data"
                            // },
                            body: formData
                        })
                            .then(response => response.json())
                            .then(data => {
                                console.log(data);
                            })
                            .catch(error => {
                                console.error(error);
                            });
                    }catch (e){
                        console.log('File upload error:', e)
                    }
                })
            }

        });

        uploader.use([new Local()]);

        uploader.use([
            new Crop(),
            new Blur(),
            new Brightness(),
            new Contrast(),
            new Grayscale(),
            new HueRotate(),
            new Invert(),
            new Saturate(),
            new Sepia()
        ]);

        uploader.on("*", (...params: any[]) => {
            // console.log(params);
        });
    }
}
export default UpploadManager;
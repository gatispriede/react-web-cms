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
    private readonly _setError: (error: string) => void;

    public error: string = 'Invalid'
    public fileName: string = ''
    public file: any = undefined
    public tags: string[] = ['All']

    constructor(previewRef: HTMLImageElement, buttonRef: HTMLButtonElement, setFile: (file: File) => void, setError: (error: string) => void) {
        this._previewRef = previewRef
        this._buttonRef = buttonRef
        this._setFile = setFile
        this._setError = setError
        this.setup()
    }

    setError(error: string) {
        this.error = error
        this._setError(error)
        setTimeout(() => {
            this.error = ''
            this._setError('')
        }, 10000)
    }

    setTags(tags: string[]): void {
        this.tags = tags
    }

    setup() {
        const uploader = new Uppload({
            compression: 0.8,
            compressionToMime: "image/webp",
            lang: en,
            bind: this._previewRef,
            call: this._buttonRef,
            value: this._defaultImgUrl,
            uploader: async (file, updateProgress) => {
                return new Promise(resolve => {
                    const resultFile = file as File
                    try {
                        this.fileName = resultFile.name
                        this.file = resultFile;
                        this._setFile(resultFile)
                        setTimeout(() => resolve(window.URL.createObjectURL(file)), 2750);

                        let progress = 0;
                        const interval = setInterval(() => {
                            if (progress > 99) clearInterval(interval);
                            if (updateProgress) updateProgress(progress++);
                        }, 25);
                        const formData = new FormData()
                        formData.append('file', file)
                        formData.append('tags', JSON.stringify(this.tags.length ? this.tags : ['All']))
                        try {
                            fetch('/api/upload', {
                                method: 'POST',
                                body: formData
                            })
                                .then(response => response.json())
                                .then(response => {
                                    if (response.error) {
                                        this.setError(response.error)
                                    }
                                })
                                .catch(error => {
                                    this.setError(error)
                                });
                        } catch (e) {
                            console.error('File upload error:', e)
                        }
                    } catch (e) {
                        console.error('File upload error:', e)
                    }
                })
            }

        });

        uploader.use([new Local()]);

        uploader.use([
            new Crop({
                aspectRatioOptions: {
                    free: NaN,
                    square: 1,
                    "16:9": 16 / 9,
                    "9:16": 9 / 16,
                    "3:2": 3 / 2,
                    "2:3": 2 / 3,
                    "4:3": 4 / 3,
                    "3:4": 3 / 4,
                }
            }),
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
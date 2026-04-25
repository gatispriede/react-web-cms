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
    private _uploader?: Uppload;
    // Focus-trap workaround state — held as private class variables so the
    // host React component doesn't have to re-render to drive it.
    //
    // Two competing focus traps (AntD Modal's rc-util trap + Uppload's own
    // focus-trap library) deadlock the browser with
    // `RangeError: Maximum call stack size exceeded`: AntD pulls focus
    // back into its Modal, Uppload pulls it back into its own, ad infinitum.
    //
    // The fix is to re-parent Uppload's modal DOM node *into* the AntD
    // Modal's root while it's open, so both share one focus-trap container
    // and rc-util considers Uppload's inputs "still inside the Modal".
    // We restore the original parent on close so subsequent opens work.
    private _isOpen: boolean = false;
    // Capturing focusin guard. AntD Modal listens for focusin at the
    // document level and `tryFocus()`-pulls focus back inside its own
    // wrapper if it spots it elsewhere. Uppload's `focus-trap` does the
    // same the other direction. We intercept events whose target is inside
    // Uppload's container and `stopImmediatePropagation` so AntD's listener
    // never sees them.
    private _focusGuard?: (e: FocusEvent) => void;

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

    /** No-op kept for call-site compatibility — earlier iterations re-parented
     *  Uppload's DOM into a host container, but that broke the trusted-
     *  gesture chain the OS file picker needs. The focus-trap conflict is
     *  now solved purely via a capturing focusin guard. */
    setHostSelector(_selector: string) { /* intentional no-op */ }

    private _relocateIntoHost() {
        if (this._isOpen) return;
        this._isOpen = true;
        const containers = document.querySelectorAll<HTMLElement>('.uppload-container');
        const container = containers[containers.length - 1];
        if (!container) return;

        // We deliberately do NOT re-parent Uppload's container — moving the
        // node disrupts the synthetic-event path that browsers require for
        // the OS file picker (the click on "Select a file" must remain in
        // the same trusted-gesture chain as the underlying `<input>.click()`,
        // and re-parenting just before the click breaks that). Instead we
        // keep Uppload exactly where it is (above the AntD Modal in the
        // DOM, with naturally higher z-index) and only suppress AntD's
        // focus-trap chatter via the capturing focusin guard below.

        // Capturing focusin guard — see the field comment above.
        this._focusGuard = (e: FocusEvent) => {
            const target = e.target as Node | null;
            if (target && container.contains(target)) {
                e.stopImmediatePropagation();
            }
        };
        document.addEventListener('focusin', this._focusGuard, true);
    }

    private _restoreFromHost() {
        this._isOpen = false;
        if (this._focusGuard) {
            document.removeEventListener('focusin', this._focusGuard, true);
            this._focusGuard = undefined;
        }
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
                const resultFile = file as File
                this.fileName = resultFile.name
                this.file = resultFile

                let progress = 0
                const interval = setInterval(() => {
                    if (progress > 99) clearInterval(interval)
                    if (updateProgress) updateProgress(progress++)
                }, 25)
                const formData = new FormData()
                formData.append('file', file)
                // Every uploaded image is tagged 'All' so it surfaces in
                // the default picker view regardless of custom tags.
                const tagsOut = this.tags.includes('All') ? this.tags : ['All', ...this.tags]
                formData.append('tags', JSON.stringify(tagsOut.length ? tagsOut : ['All']))
                try {
                    const response = await fetch('/api/upload', {method: 'POST', body: formData})
                    const body = await response.json().catch(() => ({}))
                    if (body?.error) this.setError(body.error)
                } catch (error: any) {
                    this.setError(String(error?.message ?? error))
                } finally {
                    clearInterval(interval)
                    if (updateProgress) updateProgress(100)
                }
                // Fire the consumer callback AFTER the /api/upload response
                // lands, so gallery refresh can see the new DB row.
                this._setFile(resultFile)
                return window.URL.createObjectURL(file)
            }

        });

        uploader.use([new Local()]);

        uploader.use([
            // Uppload's Crop plugin uses the FIRST entry as the default
            // aspect ratio, so "16:9" leads to match our gallery default.
            new Crop({
                aspectRatioOptions: {
                    "16:9": 16 / 9,
                    free: NaN,
                    square: 1,
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

        // Re-parent Uppload's modal under the host on open, restore on
        // close. Driven via private class variables — no React re-render
        // needed since this is pure DOM surgery.
        // `open` fires synchronously before Uppload's container is fully
        // mounted in some flows; defer one frame so `querySelector` finds it.
        uploader.on("open", () => { requestAnimationFrame(() => this._relocateIntoHost()) });
        uploader.on("close", () => { this._restoreFromHost() });

        this._uploader = uploader;
    }
}

export default UpploadManager;
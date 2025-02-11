import {EItemType} from "../../enums/EItemType";

abstract class ContentManager {
    protected _content: string = ''
    protected _type: EItemType = EItemType.Empty
    public _parsedContent: unknown;
    constructor(contentType: EItemType, content: string | unknown){
        this._type = contentType;
        if(typeof content === 'string'){
            this._content = content;
            this.parse();
        }else{
            this._parsedContent = content;
            this.stringify()
        }
    }

    abstract get data():unknown
    abstract set data(value: unknown)
    public get stringData(): string{
        this.stringify()
        return this._content;
    }
    public parse(){
        try{
            const result = JSON.parse(this._content)
            this._parsedContent = result
        }catch (e){
            console.error('Error decrypting content', e);
        }
    }
    protected stringify(){
        try{
            const jsonContent = JSON.stringify(this._parsedContent)
            this._content = jsonContent
        }catch (e){
            console.error('Error encrypting content', e);
        }
    }
}
export default ContentManager;
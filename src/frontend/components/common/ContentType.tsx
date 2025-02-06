import {EItemType} from "../../../enums/EItemType";
import {IContentTypeProps} from "../../../Interfaces/IContentTypeProps";
import PlainText from "../InputContent/PlainText";
import PlainImage from "../InputContent/PlainImage";
import RichText from "../InputContent/RichText";

const ContentType = (props: IContentTypeProps) => {
    switch (props.type) {
        case EItemType.Text:
            return (
                <PlainText content={props.content} />
            )
        case EItemType.RichText:
            return (
                <RichText content={props.content} />
            )
        case EItemType.Image:
            return (
                <PlainImage content={props.content} />
            )
        case EItemType.Empty:
            return (
                <div>
                    {props.addButton}
                </div>
            )
        default:
            return ''
    }
}
export default ContentType
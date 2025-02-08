import {EItemType} from "../../../enums/EItemType";
import {IContentTypeProps} from "../../../Interfaces/IContentTypeProps";
import PlainText from "../SectionComponents/PlainText";
import PlainImage from "../SectionComponents/PlainImage";
import RichText from "../SectionComponents/RichText";

const ContentType = (props: IContentTypeProps) => {
    switch (props.item.type) {
        case EItemType.Text:
            return (
                <PlainText item={props.item} />
            )
        case EItemType.RichText:
            return (
                <RichText item={props.item} />
            )
        case EItemType.Image:
            return (
                <PlainImage item={props.item} />
            )
        case EItemType.Empty:
            return (
                <div>
                    {props.admin && props.addButton}
                </div>
            )
        default:
            return ''
    }
}
export default ContentType
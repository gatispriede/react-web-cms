import {EItemType} from "../../../enums/EItemType";
import {IContentTypeProps} from "../../../Interfaces/IContentTypeProps";
import PlainText from "../SectionComponents/PlainText";
import PlainImage from "../SectionComponents/PlainImage";
import RichText from "../SectionComponents/RichText";
import Gallery from "../SectionComponents/Gallery";
import CarouselView from "../SectionComponents/CarouselView";

const ContentType = (props: IContentTypeProps) => {
    switch (props.item.type) {
        case EItemType.Text:
            return (
                <PlainText t={props.t} item={props.item} />
            )
        case EItemType.RichText:
            return (
                <RichText t={props.t}  item={props.item} />
            )
        case EItemType.Image:
            return (
                <PlainImage t={props.t}  item={props.item} />
            )
        case EItemType.Carousel:
            return (
                <CarouselView t={props.t}  item={props.item} />
            )
        case EItemType.Gallery:
            return (
                <Gallery t={props.t}  item={props.item} />
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
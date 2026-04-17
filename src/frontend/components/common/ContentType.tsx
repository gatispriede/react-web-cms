import {EItemType} from "../../../enums/EItemType";
import {IContentTypeProps} from "../../../Interfaces/IContentTypeProps";
import {getItemTypeDefinition} from "../itemTypes/registry";

const ContentType = (props: IContentTypeProps) => {
    if (props.item.type === EItemType.Empty) {
        return <div>{props.admin && props.addButton}</div>;
    }
    const def = getItemTypeDefinition(props.item.type);
    if (!def) return null;
    const {Display} = def;
    return <Display t={props.t} tApp={props.tApp} item={props.item}/>;
};

export default ContentType;

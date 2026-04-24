import {EItemType} from "@enums/EItemType";
import {IContentTypeProps} from "@interfaces/IContentTypeProps";
import {getItemTypeDefinition} from "@admin/lib/itemTypes/registry";

const ContentType = (props: IContentTypeProps) => {
    if (props.item.type === EItemType.Empty) {
        return <div>{props.admin && props.addButton}</div>;
    }
    const def = getItemTypeDefinition(props.item.type);
    if (!def) return null;
    const {Display} = def;
    return <Display t={props.t} tApp={props.tApp} item={props.item} admin={props.admin}/>;
};

export default ContentType;

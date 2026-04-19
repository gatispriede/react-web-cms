import {INavigation} from "./INavigation";
import {ISection} from "./ISection";
import EItemType from "../enums/EItemType";

export interface IMongo {
    mongo: {
        getMongoDBUri: string
        getNavigationCollection: INavigation[]
        getSections: ({ids}: { ids: string[] }) => ISection[]
    }
}

export interface InItem {
    name?: string;
    type: EItemType;
    style: string;
    content: string;
    action?: string;
    actionStyle?: string;
    actionType?: EItemType
    actionContent?: string
}

export interface InSection {
    id?: string
    type: number
    page: string
    content: InItem[]
    /** Column spans per item; see ISection.slots for semantics. */
    slots?: number[]
    /** Overlay flag — render this section absolutely on top of the previous. */
    overlay?: boolean
    /** Overlay anchor — `top-left` | `top-right` | `bottom-left` | `bottom-right` | `center` | `fill`. */
    overlayAnchor?: string
}

export interface MutationMongo {
    mongo: {
        addUpdateNavigationItem({pageName, sections}: { pageName?: string, sections: string[] }): string
        addUpdateSectionItem({section, pageName}: { section: InSection, pageName?: string }): string
        removeSectionItem({id}: { id: string }): string
        deleteNavigationItem({pageName}: { pageName: string }): string
    }
}
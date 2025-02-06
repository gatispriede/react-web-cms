import {INavigation} from "./INavigation";
import {ISection} from "./ISection";

export interface IMongo {
    mongo: {
        getMongoDBUri: string
        getNavigationCollection: INavigation[]
        getSections: ({ids}: { ids: string[] }) => ISection[]
    }
}

export interface InItem {
    name?: string
    type: string
    content: string
}

export interface InSection {
    id?: string
    type: number
    page: string
    content: InItem[]
}

export interface MutationMongo {
    mongo: {
        addUpdateNavigationItem({pageName, sections}: { pageName?: string, sections: string[] }): string
        addUpdateSectionItem({section, pageName}: { section: InSection, pageName?: string }): string
        removeSectionItem({id}: { id: string }): string
        deleteNavigationItem({pageName}: { pageName: string }): string
    }
}
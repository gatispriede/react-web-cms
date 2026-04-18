// Configuration and settings for MongoDB connection
import {IUser} from "../Interfaces/IUser";
import {INewLanguage} from "../frontend/components/interfaces/INewLanguage";
import {ILogo} from "../Interfaces/ILogo";
import IImage, {InImage} from "../Interfaces/IImage";
import {INavigation} from "../Interfaces/INavigation";
import {ISection} from "../Interfaces/ISection";
import {InSection} from "../Interfaces/IMongo";

export interface ISettings {
    apiKey: string;
    username: string;
    password: string;
    DB: string;
    mongodb: string;
    mongodbUser: string;
    mongodbPassword: string;
    mongoDBClusterUrl: string;
    mongoDBDatabaseUrl: string;
    mongoDBLocalUrl: string;
}

export interface ILoadData {
    name: string;
    sizeOnDisk?: number | undefined;
    empty?: boolean | undefined;
}

const server = process.env.NODE_SERVER_PORT ? 'mongodb' : 'localhost';

/**
 * All sensitive defaults now come from environment variables.
 * Fall back to empty strings so a missing env var fails loudly on first DB call
 * rather than silently using a real stolen credential committed to history.
 *
 * Required env in production:
 *   MONGODB_URI              full connection string (overrides local/cluster below)
 *   ADMIN_DEFAULT_PASSWORD   seed password for the admin user on first boot
 * Optional:
 *   MONGODB_USER             legacy Atlas user (for mongoDBClusterUrl path)
 *   MONGODB_PASSWORD         legacy Atlas password
 *   MONGODB_CLUSTER_URL      legacy Atlas cluster hostname
 */
export const defaultSettings: ISettings = {
    apiKey: process.env.CMS_API_KEY ?? '',
    DB: process.env.MONGODB_DB ?? 'MAIN-DB',
    username: 'Admin',
    password: process.env.ADMIN_DEFAULT_PASSWORD ?? '',
    mongodb: 'Cluster',
    mongodbUser: process.env.MONGODB_USER ?? '',
    mongodbPassword: process.env.MONGODB_PASSWORD ?? '',
    mongoDBClusterUrl: process.env.MONGODB_CLUSTER_URL ?? '',
    mongoDBLocalUrl: process.env.MONGODB_URI ?? `mongodb://${server}:27017`,
    mongoDBDatabaseUrl: ''
};


export interface IMongoDBConnection {
    setupClient(): Promise<void>;
    setupAdmin(): Promise<IUser | undefined>;
    addUser({user}: { user: any }): Promise<string | IUser | undefined>;
    updateUser({user}: { user: any }): Promise<string>;
    removeUser({id}: { id: string }): Promise<string>;
    getUsers(): Promise<IUser[]>;
    getLanguages(): Promise<INewLanguage[] | string>;
    addUpdateLanguage({language, translations}: { language: INewLanguage, translations: JSON }): Promise<string>;
    deleteLanguage({language}: { language: INewLanguage }): Promise<string>;
    getUser({email}: { email: string }): Promise<IUser | undefined>;
    saveLogo({content}: { content: string }): Promise<string>;
    getLogo(): Promise<ILogo | undefined>;
    deleteImage({id}: { id: string }): Promise<string>;
    saveImage({image}: { image: InImage }): Promise<string>;
    getImages({tags}: { tags: string }): Promise<IImage[]>;
    loadData(): Promise<ILoadData[]>;
    updateNavigation({page, sections}: { page: string, sections: string[] }): Promise<string>;
    createNavigation({navigation}: { navigation: INavigation }): Promise<string>;
    replaceUpdateNavigation({oldPageName, navigation}: { oldPageName: string, navigation: INavigation }): Promise<string>;
    getNavigationCollection(): Promise<INavigation[]>;
    getSections({ids}: { ids: string[] }): Promise<ISection[]>;
    removeSectionItem({id}: { id: string }): Promise<string>;
    addUpdateSectionItem({section, pageName}: { section: ISection, pageName?: string }): Promise<string>;
    deleteNavigationItem({pageName}: { pageName: string }): Promise<string>;
    addUpdateNavigationItem({pageName, sections}: { pageName: string, sections?: string[] }): Promise<string>;
    getMongoDBUri(): string;
}

export interface INavigationService {
    createNavigation(newNavigation: INavigation): Promise<string>;
    updateNavigation(page: string, sections: string[]): Promise<string>;
    getNavigationCollection(): Promise<INavigation[]>;
    getSections(sectionIds: string[]): Promise<ISection[]>;
    addUpdateSectionItem(item: { section: InSection, pageName?: string }): Promise<string>;
    removeSectionItem(sectionId: string): Promise<string>;
    replaceUpdateNavigation(oldPageName: string, navigation: INavigation): Promise<string>;
    deleteNavigationItem(pageName: string): Promise<string>;
    addUpdateNavigationItem(pageName: string, sections?: string[]): Promise<string>;
}
export interface IAssetService {
    getLogo(): Promise<ILogo | undefined>;
    saveLogo(content: string): Promise<string>;
    saveImage(image: InImage): Promise<string>;
    deleteImage(id: string): Promise<string>;
    getImages(tags: string): Promise<IImage[]>;
}
export interface ILanguageService {
    getLanguages(): Promise<INewLanguage[]>;
    addUpdateLanguage(input: { language: INewLanguage, translations: JSON }): Promise<string>;
    deleteLanguage(input: { language: INewLanguage }): Promise<string>;
}
export interface IUserService {
    setupAdmin(): Promise<IUser | undefined>;
    addUser({user}: { user: IUser | any }): Promise<string | IUser | undefined>;
    updateUser({user}: { user: any }): Promise<string>;
    removeUser({id}: { id: string }): Promise<string>;
    getUser({email}: { email: string }): Promise<IUser | undefined>;
    getUsers(): Promise<IUser[]>;
}

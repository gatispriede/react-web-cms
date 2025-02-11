"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongodb_1 = require("mongodb");
var guid_1 = require("../helpers/guid");
var MongoDBConnection = /** @class */ (function () {
    function MongoDBConnection() {
        this._settings = {
            apiKey: '',
            DB: 'MAIN-DB',
            username: 'Admin',
            password: 'b[ua25cJW2PF',
            mongodb: 'Cluster',
            mongodbUser: 'admin',
            mongodbPassword: 'AMd011wAQNN3eWwP',
            mongoDBClusterUrl: 'cluster.0fmyz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster',
            mongoDBDatabaseUrl: ''
        };
        this._settings.mongoDBDatabaseUrl = "mongodb+srv://".concat(this._settings.mongodbUser, ":").concat(this._settings.mongodbPassword, "@").concat(this._settings.mongoDBClusterUrl);
        var newClient = new mongodb_1.MongoClient(this._settings.mongoDBDatabaseUrl, {
            monitorCommands: true,
            connectTimeoutMS: 200,
            maxConnecting: 75,
            waitQueueTimeoutMS: 2000,
        });
        if (newClient) {
            this.client = newClient;
            this.sectionsDB = this.client.db('Homepage').collection('Sections');
            this.navigationsDB = this.client.db('Homepage').collection('Navigation');
        }
    }
    MongoDBConnection.prototype.loadData = function () {
        return __awaiter(this, void 0, void 0, function () {
            var dbs, databases;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.client) {
                            return [2 /*return*/, []];
                        }
                        return [4 /*yield*/, this.client.db().admin().listDatabases()];
                    case 1:
                        dbs = _a.sent();
                        databases = dbs.databases;
                        return [2 /*return*/, databases];
                }
            });
        });
    };
    MongoDBConnection.prototype.getNavigationCollection = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.client) {
                            return [2 /*return*/, 0];
                        }
                        return [4 /*yield*/, this.navigationsDB.find({ type: 'navigation' }).toArray()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MongoDBConnection.prototype.getSections = function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var sections;
            var _this = this;
            var ids = _b.ids;
            return __generator(this, function (_c) {
                if (!this.client) {
                    return [2 /*return*/, 0];
                }
                sections = [];
                ids.map(function (id) {
                    var section = _this.sectionsDB.findOne({ id: id });
                    sections.push(section);
                });
                return [2 /*return*/, sections];
            });
        });
    };
    MongoDBConnection.prototype.removeSectionItem = function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var sectionItem, returnResult, navigationItem, indexToRemove, deleteResult;
            var id = _b.id;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.client) {
                            console.log('no client');
                            return [2 /*return*/, 'no client'];
                        }
                        return [4 /*yield*/, this.sectionsDB.findOne({ id: id })];
                    case 1:
                        sectionItem = _c.sent();
                        if (!sectionItem) {
                            return [2 /*return*/, 'no item with id: ' + id];
                        }
                        returnResult = '';
                        if (!sectionItem.page) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.navigationsDB.findOne({
                                type: 'navigation',
                                page: sectionItem.page
                            })];
                    case 2:
                        navigationItem = _c.sent();
                        indexToRemove = navigationItem.sections.findIndex(function (v) { return v === id; });
                        if (!(indexToRemove > -1)) return [3 /*break*/, 4];
                        navigationItem.sections.splice(indexToRemove, 1);
                        return [4 /*yield*/, this.navigationsDB.findOneAndUpdate({
                                type: 'navigation',
                                page: sectionItem.page
                            }, { $set: { sections: navigationItem.sections } })];
                    case 3:
                        _c.sent();
                        returnResult += ' removing from ' + sectionItem.page + ' ' + sectionItem.id + ' at index: ' + indexToRemove;
                        _c.label = 4;
                    case 4: return [4 /*yield*/, this.sectionsDB.deleteOne({ id: id })];
                    case 5:
                        deleteResult = _c.sent();
                        returnResult += "  " + JSON.stringify(deleteResult);
                        return [2 /*return*/, returnResult];
                }
            });
        });
    };
    MongoDBConnection.prototype.addUpdateSectionItem = function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var response, result, result, navigationItem, found, navigation;
            var section = _b.section, pageName = _b.pageName;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.client) {
                            console.log('no client');
                            return [2 /*return*/, 'no client'];
                        }
                        response = {
                            updateSection: {},
                            createSection: {},
                            updateNavigation: {}
                        };
                        if (!section.id) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.sectionsDB.findOneAndUpdate({ id: section.id }, { $set: section })];
                    case 1:
                        result = _c.sent();
                        if (!result) {
                            return [2 /*return*/, 'error, no section found with the ID provided'];
                        }
                        response.updateSection = result;
                        return [3 /*break*/, 4];
                    case 2:
                        section.id = (0, guid_1.default)();
                        return [4 /*yield*/, this.sectionsDB.insertOne(section)];
                    case 3:
                        result = _c.sent();
                        response.createSection = result;
                        // @ts-ignore
                        response.createSection.id = section.id;
                        _c.label = 4;
                    case 4:
                        if (!pageName) return [3 /*break*/, 7];
                        section.page = pageName;
                        return [4 /*yield*/, this.navigationsDB.findOne({
                                type: 'navigation',
                                page: pageName
                            })];
                    case 5:
                        navigationItem = _c.sent();
                        if (!navigationItem) return [3 /*break*/, 7];
                        found = navigationItem.sections.find(function (v) { return v === section.id; });
                        if (!(navigationItem && !found)) return [3 /*break*/, 7];
                        navigationItem.sections.push(section.id);
                        return [4 /*yield*/, this.navigationsDB.findOneAndUpdate({
                                type: 'navigation',
                                page: pageName
                            }, { $set: { sections: navigationItem.sections } })
                            // @ts-ignore
                        ];
                    case 6:
                        navigation = _c.sent();
                        // @ts-ignore
                        response.updateNavigation = navigation;
                        _c.label = 7;
                    case 7: return [2 /*return*/, JSON.stringify(response)];
                }
            });
        });
    };
    MongoDBConnection.prototype.deleteNavigationItem = function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var navigationItem, result;
            var pageName = _b.pageName;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.client) {
                            console.log('no client');
                            return [2 /*return*/, 'no client'];
                        }
                        return [4 /*yield*/, this.navigationsDB.findOne({
                                type: 'navigation',
                                page: pageName
                            })];
                    case 1:
                        navigationItem = _c.sent();
                        if (!navigationItem) {
                            return [2 /*return*/, 'no navigation found for page:' + pageName];
                        }
                        return [4 /*yield*/, this.navigationsDB.deleteOne({
                                type: 'navigation',
                                page: pageName
                            })];
                    case 2:
                        result = _c.sent();
                        return [2 /*return*/, JSON.stringify(result)];
                }
            });
        });
    };
    MongoDBConnection.prototype.addUpdateNavigationItem = function (_a) {
        return __awaiter(this, arguments, void 0, function (_b) {
            var navigationCollection, navigationItemInDb, navigationItem, result, result;
            var pageName = _b.pageName, sections = _b.sections;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!this.client) {
                            console.log('no client');
                            return [2 /*return*/, 'no client'];
                        }
                        navigationCollection = this.navigationsDB;
                        return [4 /*yield*/, navigationCollection.findOne({
                                type: 'navigation',
                                page: pageName
                            })];
                    case 1:
                        navigationItemInDb = _c.sent();
                        if (!navigationItemInDb) {
                            navigationItem = {
                                id: (0, guid_1.default)(),
                                type: 'navigation',
                                page: pageName,
                                sections: []
                            };
                        }
                        else {
                            navigationItem = navigationItemInDb;
                        }
                        if (sections) {
                            navigationItem.sections = sections;
                        }
                        if (!!navigationItemInDb) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.navigationsDB.insertOne(navigationItem)];
                    case 2:
                        result = _c.sent();
                        return [2 /*return*/, JSON.stringify(result)];
                    case 3: return [4 /*yield*/, navigationCollection.findOneAndUpdate({
                            type: 'navigation',
                            page: pageName
                        }, { $set: navigationItem })];
                    case 4:
                        result = _c.sent();
                        return [2 /*return*/, JSON.stringify(result)];
                }
            });
        });
    };
    MongoDBConnection.prototype.getMongoDBUri = function () {
        return this._settings.mongoDBDatabaseUrl;
    };
    return MongoDBConnection;
}());
exports.default = MongoDBConnection;

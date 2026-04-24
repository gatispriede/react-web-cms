/**
 * Icon adapter — single source of truth mapping the previously-used
 * `@ant-design/icons` exports to their `lucide-react` equivalents.
 *
 * The codebase doesn't import lucide directly: instead each consumer
 * imports the adapted name from this file (`import {DeleteOutlined} from
 * 'common/icons'`). That keeps:
 *
 *   1. The mapping table in one place — the file you're reading.
 *   2. The import-site diff trivial — only the import path changes; JSX
 *      stays the same so a callsite using `<DeleteOutlined style={…}/>`
 *      doesn't need rewriting.
 *   3. AntD components happy — they accept any ReactNode for `icon`/
 *      `indicator`/etc. props, so a wrapped lucide icon drops in.
 *
 * Sizing: AntD's outlined icons render at 16 px by default; lucide
 * defaults to 24 px. `IconBase` forces 16 px unless the consumer passes
 * an explicit `size`. Stroke weight (1.75) lands between AntD's two-tone
 * strokes and lucide's default 2 px so the optical density matches the
 * surrounding 16 px AntD chrome.
 *
 * "Filled" variants (`*Filled` suffix in AntD) render the same lucide
 * icon with `fill="currentColor"` so the inner area takes the parent
 * colour — closest the stroke-only lucide library can get to AntD's
 * solid look.
 *
 * `LoadingOutlined.spin` — AntD's `<Spin indicator={…spin}/>` pattern
 * relies on the icon spinning. The adapter accepts `spin?: boolean`
 * and applies a 1 s rotation when set; default for `LoadingOutlined`
 * is `spin: true` (loading icons should always spin).
 *
 * Adding a new icon: pick the closest lucide name from
 * https://lucide.dev/icons, add it to the imports below, then add a
 * named export wrapping `IconBase`. Don't import directly from
 * `lucide-react` in feature code — keep the mapping centralised.
 */
import React, {CSSProperties, SVGProps} from 'react';
import {
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    Clock,
    CloudUpload,
    Copy,
    Download,
    ExternalLink,
    Eye,
    File,
    FileText,
    Github,
    Globe,
    History,
    Info,
    LayoutDashboard,
    LayoutGrid,
    Lightbulb,
    Linkedin,
    Link as LinkIcon,
    Loader2,
    LogOut,
    Mail,
    Merge,
    MoveHorizontal,
    Palette,
    Pencil,
    Phone,
    Image as ImageIcon,
    Plus,
    PlusCircle,
    RefreshCw,
    Redo2,
    Search,
    Settings,
    Split,
    Trash2,
    Twitter,
    Undo2,
    Upload,
    User,
    X,
    XCircle,
    Youtube,
    Zap,
} from 'lucide-react';

const SPIN_KEYFRAMES_ID = 'lucide-spin-keyframes';

function ensureSpinKeyframes() {
    if (typeof document === 'undefined') return;
    if (document.getElementById(SPIN_KEYFRAMES_ID)) return;
    const style = document.createElement('style');
    style.id = SPIN_KEYFRAMES_ID;
    style.textContent = `@keyframes lucide-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`;
    document.head.appendChild(style);
}

interface IconBaseProps extends Omit<SVGProps<SVGSVGElement>, 'fill'> {
    size?: number;
    spin?: boolean;
    /** When `true`, render with `fill="currentColor"` for the AntD `*Filled` look. */
    filled?: boolean;
}

interface AdapterProps extends IconBaseProps {
    component: React.ComponentType<{
        size?: number;
        strokeWidth?: number;
        fill?: string;
        className?: string;
        style?: CSSProperties;
    } & React.SVGAttributes<SVGElement>>;
}

const SPIN_STYLE: CSSProperties = {animation: 'lucide-spin 1s linear infinite'};

const IconBase: React.FC<AdapterProps> = ({component: Cmp, size = 16, spin, filled, style, className, strokeWidth: _sw, ...rest}) => {
    if (spin) ensureSpinKeyframes();
    const merged: CSSProperties = {
        verticalAlign: '-0.125em',
        ...(spin ? SPIN_STYLE : null),
        ...style,
    };
    return (
        <Cmp
            size={size}
            strokeWidth={1.75}
            {...(filled ? {fill: 'currentColor'} : {})}
            className={className}
            style={merged}
            {...rest}
        />
    );
};

// ---- Mapping table — sorted by AntD name ---------------------------------------

export const AppstoreOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={LayoutGrid} {...p}/>;
export const ArrowLeftOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={ArrowLeft} {...p}/>;
export const AuditOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={ClipboardList} {...p}/>;
export const BgColorsOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Palette} {...p}/>;
export const BulbFilled: React.FC<IconBaseProps> = (p) => <IconBase component={Lightbulb} filled {...p}/>;
export const BulbOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Lightbulb} {...p}/>;
export const CheckCircleFilled: React.FC<IconBaseProps> = (p) => <IconBase component={CheckCircle2} filled {...p}/>;
export const ClockCircleOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Clock} {...p}/>;
export const CloseCircleFilled: React.FC<IconBaseProps> = (p) => <IconBase component={XCircle} filled {...p}/>;
export const CloseOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={X} {...p}/>;
export const CloudUploadOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={CloudUpload} {...p}/>;
export const ColumnWidthOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={MoveHorizontal} {...p}/>;
export const CopyOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Copy} {...p}/>;
export const DeleteOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Trash2} {...p}/>;
export const DownloadOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Download} {...p}/>;
export const DownOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={ChevronDown} {...p}/>;
export const EditOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Pencil} {...p}/>;
export const ExportOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={ExternalLink} {...p}/>;
export const EyeOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Eye} {...p}/>;
export const FileOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={File} {...p}/>;
export const FileTextOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={FileText} {...p}/>;
export const GithubOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Github} {...p}/>;
export const GlobalOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Globe} {...p}/>;
export const HistoryOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={History} {...p}/>;
export const InfoCircleOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Info} {...p}/>;
export const LayoutOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={LayoutDashboard} {...p}/>;
export const LinkedinOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Linkedin} {...p}/>;
export const LinkOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={LinkIcon} {...p}/>;
export const LoadingOutlined: React.FC<IconBaseProps> = ({spin = true, ...p}) => <IconBase component={Loader2} spin={spin} {...p}/>;
export const LogoutOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={LogOut} {...p}/>;
export const MailOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Mail} {...p}/>;
export const MergeCellsOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Merge} {...p}/>;
export const PhoneOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Phone} {...p}/>;
export const PictureOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={ImageIcon} {...p}/>;
export const PlusCircleOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={PlusCircle} {...p}/>;
export const PlusOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Plus} {...p}/>;
export const RedoOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Redo2} {...p}/>;
export const ReloadOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={RefreshCw} {...p}/>;
export const RollbackOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Undo2} {...p}/>;
export const ReadOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={BookOpen} {...p}/>;
export const SearchOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Search} {...p}/>;
export const SettingOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Settings} {...p}/>;
export const SplitCellsOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Split} {...p}/>;
export const ThunderboltOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Zap} {...p}/>;
export const TwitterOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Twitter} {...p}/>;
export const UndoOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Undo2} {...p}/>;
export const UpOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={ChevronUp} {...p}/>;
export const UploadOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Upload} {...p}/>;
export const UserOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={User} {...p}/>;
export const YoutubeOutlined: React.FC<IconBaseProps> = (p) => <IconBase component={Youtube} {...p}/>;

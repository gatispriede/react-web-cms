import React from "react";
import {EItemType} from "../../../enums/EItemType";

/**
 * Tiny SVG wireframes shown next to each item type in the picker.
 * Muted strokes so they work on light + dark admin chrome.
 */
const stroke = 'currentColor';
const fill = 'currentColor';
const softFill = 'rgba(0,0,0,0.08)';

const Wrap: React.FC<{children: React.ReactNode}> = ({children}) => (
    <svg viewBox="0 0 64 40" width={56} height={36} style={{flexShrink: 0, opacity: .75}} xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="0.5" width="63" height="39" rx="3" fill="none" stroke={stroke} strokeOpacity={.25}/>
        {children}
    </svg>
);

const DIAGRAMS: Partial<Record<EItemType, React.ReactNode>> = {
    [EItemType.Text]: (
        <Wrap>
            <rect x="6" y="12" width="52" height="2" fill={fill}/>
            <rect x="6" y="18" width="44" height="2" fill={fill}/>
            <rect x="6" y="24" width="50" height="2" fill={fill}/>
        </Wrap>
    ),
    [EItemType.RichText]: (
        <Wrap>
            <rect x="6" y="10" width="20" height="3" fill={fill}/>
            <rect x="6" y="17" width="52" height="2" fill={fill}/>
            <rect x="6" y="22" width="38" height="2" fill={fill}/>
            <rect x="6" y="27" width="46" height="2" fill={fill} opacity={.7}/>
        </Wrap>
    ),
    [EItemType.Image]: (
        <Wrap>
            <rect x="8" y="8" width="48" height="24" fill={softFill} stroke={stroke} strokeOpacity={.4}/>
            <circle cx="20" cy="18" r="3" fill={fill} opacity={.6}/>
            <path d="M14 30 L24 22 L34 28 L48 18 L56 30 Z" fill={fill} opacity={.45}/>
        </Wrap>
    ),
    [EItemType.Gallery]: (
        <Wrap>
            {[0, 16, 32, 48].map((x, i) => (
                <rect key={i} x={4 + x * 0.25} y="8" width="12" height="24" fill={softFill} stroke={stroke} strokeOpacity={.4}/>
            ))}
        </Wrap>
    ),
    [EItemType.Carousel]: (
        <Wrap>
            <rect x="8" y="8" width="48" height="20" fill={softFill} stroke={stroke} strokeOpacity={.4}/>
            <circle cx="26" cy="34" r="1.5" fill={fill}/>
            <circle cx="32" cy="34" r="1.5" fill={fill} opacity={.5}/>
            <circle cx="38" cy="34" r="1.5" fill={fill} opacity={.5}/>
        </Wrap>
    ),
    [EItemType.Hero]: (
        <Wrap>
            <rect x="4" y="4" width="56" height="32" fill={softFill}/>
            <rect x="14" y="14" width="36" height="4" fill={fill}/>
            <rect x="18" y="22" width="28" height="2" fill={fill} opacity={.6}/>
            <rect x="22" y="28" width="20" height="2" fill={fill} opacity={.4}/>
        </Wrap>
    ),
    [EItemType.ProjectCard]: (
        <Wrap>
            <rect x="8" y="6" width="48" height="14" fill={softFill}/>
            <rect x="8" y="23" width="28" height="3" fill={fill}/>
            <rect x="8" y="29" width="40" height="2" fill={fill} opacity={.6}/>
            <rect x="8" y="33" width="8" height="3" rx="1.5" fill={fill} opacity={.5}/>
            <rect x="18" y="33" width="10" height="3" rx="1.5" fill={fill} opacity={.5}/>
        </Wrap>
    ),
    [EItemType.SkillPills]: (
        <Wrap>
            <rect x="6" y="10" width="14" height="3" fill={fill} opacity={.6}/>
            <rect x="6" y="19" width="11" height="5" rx="2.5" fill={fill} opacity={.3}/>
            <rect x="20" y="19" width="14" height="5" rx="2.5" fill={fill} opacity={.3}/>
            <rect x="37" y="19" width="10" height="5" rx="2.5" fill={fill} opacity={.3}/>
            <rect x="50" y="19" width="8" height="5" rx="2.5" fill={fill} opacity={.3}/>
            <rect x="6" y="27" width="12" height="5" rx="2.5" fill={fill} opacity={.3}/>
            <rect x="21" y="27" width="18" height="5" rx="2.5" fill={fill} opacity={.3}/>
        </Wrap>
    ),
    [EItemType.Timeline]: (
        <Wrap>
            <line x1="12" y1="6" x2="12" y2="34" stroke={stroke} strokeWidth={1.5} opacity={.5}/>
            {[10, 20, 30].map((y, i) => (
                <g key={i}>
                    <circle cx="12" cy={y} r="2.5" fill={fill}/>
                    <rect x="20" y={y - 1} width="20" height="2" fill={fill}/>
                    <rect x="20" y={y + 3} width="28" height="1.5" fill={fill} opacity={.4}/>
                </g>
            ))}
        </Wrap>
    ),
    [EItemType.SocialLinks]: (
        <Wrap>
            {[10, 22, 34, 46].map((x, i) => (
                <circle key={i} cx={x + 4} cy="20" r="4" fill={softFill} stroke={stroke} strokeOpacity={.5}/>
            ))}
        </Wrap>
    ),
    [EItemType.BlogFeed]: (
        <Wrap>
            {[[6, 6], [26, 6], [46, 6], [6, 22], [26, 22], [46, 22]].map(([x, y], i) => (
                <rect key={i} x={x} y={y} width="16" height="12" fill={softFill} stroke={stroke} strokeOpacity={.4}/>
            ))}
        </Wrap>
    ),
    [EItemType.List]: (
        <Wrap>
            {[10, 18, 26].map((y, i) => (
                <g key={i}>
                    <rect x="6" y={y} width="14" height="2" fill={fill} opacity={.6}/>
                    <rect x="24" y={y} width="34" height="2" fill={fill} opacity={.4}/>
                </g>
            ))}
            <line x1="6" y1="14" x2="58" y2="14" stroke={stroke} strokeOpacity={.2}/>
            <line x1="6" y1="22" x2="58" y2="22" stroke={stroke} strokeOpacity={.2}/>
            <line x1="6" y1="30" x2="58" y2="30" stroke={stroke} strokeOpacity={.2}/>
        </Wrap>
    ),
    [EItemType.Services]: (
        <Wrap>
            <rect x="6" y="6" width="14" height="3" fill={fill} opacity={.6}/>
            {[[6, 14], [22, 14], [38, 14], [6, 26], [22, 26], [38, 26]].map(([x, y], i) => (
                <g key={i}>
                    <rect x={x} y={y} width="14" height="8" fill={softFill} stroke={stroke} strokeOpacity={.35}/>
                    <rect x={x + 1.5} y={y + 2} width="6" height="1.5" fill={fill}/>
                    <rect x={x + 1.5} y={y + 5} width="10" height="1" fill={fill} opacity={.45}/>
                </g>
            ))}
        </Wrap>
    ),
    [EItemType.Testimonials]: (
        <Wrap>
            <text x="8" y="14" fontSize="9" fill={fill} opacity={.55} fontFamily="serif">&ldquo;</text>
            <rect x="14" y="10" width="42" height="2" fill={fill} opacity={.6}/>
            <rect x="14" y="14" width="36" height="2" fill={fill} opacity={.45}/>
            <rect x="14" y="18" width="40" height="2" fill={fill} opacity={.45}/>
            <circle cx="14" cy="30" r="3" fill={softFill} stroke={stroke} strokeOpacity={.4}/>
            <rect x="20" y="28" width="14" height="2" fill={fill} opacity={.6}/>
            <rect x="20" y="32" width="22" height="1.5" fill={fill} opacity={.4}/>
        </Wrap>
    ),
    [EItemType.StatsCard]: (
        <Wrap>
            <rect x="6" y="6" width="10" height="2" fill={fill} opacity={.6}/>
            <rect x="6" y="11" width="22" height="3" fill={fill}/>
            {[[6, 18], [22, 18], [38, 18]].map(([x, y], i) => (
                <g key={i}>
                    <rect x={x} y={y} width="14" height="6" fill={softFill} stroke={stroke} strokeOpacity={.4}/>
                    <rect x={x + 1.5} y={y + 1.5} width="6" height="2" fill={fill}/>
                    <rect x={x + 1.5} y={y + 4} width="10" height="1" fill={fill} opacity={.4}/>
                </g>
            ))}
            <line x1="6" y1="28" x2="58" y2="28" stroke={stroke} strokeOpacity={.2}/>
            <rect x="6" y="31" width="22" height="2" fill={fill} opacity={.5}/>
        </Wrap>
    ),
    [EItemType.ProjectGrid]: (
        <Wrap>
            <rect x="6" y="5" width="10" height="2" fill={fill} opacity={.6}/>
            <rect x="6" y="9" width="22" height="3" fill={fill}/>
            {[[6, 16], [24, 16], [42, 16], [6, 26], [24, 26], [42, 26]].map(([x, y], i) => (
                <g key={i}>
                    <rect x={x} y={y} width="14" height="8" fill={softFill} stroke={stroke} strokeOpacity={.35}/>
                </g>
            ))}
        </Wrap>
    ),
    [EItemType.Manifesto]: (
        <Wrap>
            <rect x="6" y="6" width="2" height="28" fill={fill} opacity={.5}/>
            <rect x="12" y="8" width="46" height="3" fill={fill}/>
            <rect x="12" y="14" width="42" height="2" fill={fill} opacity={.6}/>
            <rect x="12" y="18" width="48" height="2" fill={fill} opacity={.6}/>
            <rect x="12" y="22" width="40" height="2" fill={fill} opacity={.6}/>
            <rect x="12" y="28" width="6" height="3" rx="1.5" fill={fill} opacity={.4}/>
            <rect x="20" y="28" width="8" height="3" rx="1.5" fill={fill} opacity={.4}/>
            <rect x="30" y="28" width="6" height="3" rx="1.5" fill={fill} opacity={.4}/>
        </Wrap>
    ),
};

const TypeDiagram: React.FC<{type: string | EItemType}> = ({type}) => {
    const node = DIAGRAMS[type as EItemType];
    if (!node) return <div style={{width: 56, height: 36}}/>;
    return <>{node}</>;
};

export default TypeDiagram;

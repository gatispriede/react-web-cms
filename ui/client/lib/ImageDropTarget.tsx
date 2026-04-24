import React, {CSSProperties, ReactNode} from 'react';
import {message} from 'antd';
import {ImageDropPayload, useImageDrop, UseImageDropOptions} from '@client/lib/useImageDrop';

/**
 * Shared wrapper that turns any element into an image drop target. Swallows
 * the `useImageDrop` boilerplate (drop handlers, hover / upload visual state,
 * error-toasting) so consumers only write the "what to do with the image"
 * callback:
 *
 *   <ImageDropTarget onImage={(p) => setSrc(p.name)}>
 *     <img src={data.src}/>
 *   </ImageDropTarget>
 *
 * Chrome lives in `ImageDropTarget.scss` — the wrapper only sets data-*
 * attributes that SCSS keys off. Targets that need a custom hint string
 * pass `hint`; otherwise the wrapper picks one based on whether the target
 * already has a src (replace) or not (add).
 *
 * Accepts:
 *   • internal picker drags (`application/x-cms-image`) — no upload
 *   • OS file drops         (`DataTransfer.files`)       — POSTs `/api/upload`
 *   • URL drops             (`text/uri-list` / `text/plain`) — fetches + re-hosts
 *
 * See `docs/roadmap/drag-drop-images-modules.md` for the design intent and
 * `useImageDrop.ts` for the accept / upload logic.
 */
interface ImageDropTargetProps {
    /** Fired once per successfully-resolved image. Called per-file for
     *  multi-file drops — consumers that only care about a single slot
     *  should overwrite the previous value; list-style targets (Gallery,
     *  Carousel) naturally append. */
    onImage: (payload: ImageDropPayload) => void;
    children: ReactNode;
    /** Tooltip-style label shown mid-target on drag-over. Defaults to a
     *  contextual hint based on `filled`: "Drop to replace" vs "Drop to add". */
    hint?: string;
    /** Lets list-style targets switch the default hint to "replace"/"add"
     *  without overriding it manually. Ignored when `hint` is set. */
    filled?: boolean;
    /** Hover state classes (drop-hover, filled, etc.) applied to the
     *  wrapper — typed loosely so callers can pass AntD / module-specific
     *  class names without having to spread props. */
    className?: string;
    style?: CSSProperties;
    /** Optional passthrough to `useImageDrop` — e.g. disable file/URL
     *  drops on targets where only internal drags make sense. */
    options?: UseImageDropOptions;
    /** Tag override — a few consumers wrap `<img>` in `<span>` or `<li>`.
     *  Default `div` fits the majority of module editors. */
    as?: 'div' | 'span' | 'li';
}

/** Label used for the mid-target hint. Kept separate so tests can assert
 *  them without rendering the whole chrome. */
function defaultHint(filled: boolean | undefined): string {
    return filled ? 'Drop to replace' : 'Drop to add';
}

const ImageDropTarget: React.FC<ImageDropTargetProps> = ({
    onImage,
    children,
    hint,
    filled,
    className,
    style,
    options,
    as = 'div',
}) => {
    const {dropHandlers, isDragOver, isUploading} = useImageDrop(
        onImage,
        {
            ...options,
            // Surface upload errors through AntD's global message bus — one
            // toast per failed file. Consumers can still override by passing
            // their own `options.onError`.
            onError: options?.onError ?? ((msg) => { void message.error(msg); }),
        },
    );
    const Tag = as as any;
    return (
        <Tag
            {...dropHandlers}
            className={`image-drop-target${className ? ' ' + className : ''}`}
            data-drop-active={isDragOver ? 'true' : undefined}
            data-drop-uploading={isUploading ? 'true' : undefined}
            style={style}
        >
            {children}
            <span className="image-drop-target__hint">
                {hint ?? defaultHint(filled)}
            </span>
            {isUploading && <span className="image-drop-target__spinner" aria-hidden/>}
        </Tag>
    );
};

export default ImageDropTarget;

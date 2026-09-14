"use client";

import { aspectRatioStyle, cx, createLayoutClasses, growStyle, inlineAspectRatioClassName, inlineGrowClassName, needsInlineAspectRatio, needsInlineGrow, radiusClasses, resolveRadiusInput, resolveResponsive, sizeClasses, sizeInlineStyle, splitRootDomProps, stateLinkProps, tokenStyles, type GrowProps, type RadiusInput, type StateLinkInput, type ResponsiveValue, type SizeInput, type SizeValue, type WithRef, useMergedRefs } from '../core';
import type React from 'react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';

import styles from './Video.module.scss';

const c = createLayoutClasses([styles, tokenStyles]);

type ObjectFitKey = 'contain' | 'cover' | 'fill' | 'none' | 'scale_down';
type MediaSource = string | { src: string };

function resolveMediaSource(source?: MediaSource): string | undefined {
  if (!source) return undefined;

  return typeof source === 'string' ? source : source.src;
}

type VideoBaseProps = Omit<
  React.VideoHTMLAttributes<HTMLVideoElement>,
  | 'className'
  | 'style'
  | 'src'
  | 'width'
  | 'height'
  | 'poster'
>;

type VideoRootSizeProps = {
  rootW?: ResponsiveValue<SizeValue>;
  rootH?: ResponsiveValue<SizeValue>;
};

type VideoElementProps = VideoBaseProps & Record<string, unknown>;

export interface VideoProps extends VideoBaseProps, SizeInput, RadiusInput, VideoRootSizeProps, GrowProps, SharedMotionProps {
  className?: string;
  style?: CSSProperties;
  'data-point-events'?: string;

  src?: MediaSource;
  poster?: MediaSource;

  aspectRatio?: ResponsiveValue<string>;
  objectFit?: ResponsiveValue<ObjectFitKey>;
  objectPosition?: ResponsiveValue<string>;

  bg?: string;

  linkState?: StateLinkInput;
  showPlayButton?: boolean;
}

export function Video({
  ref,
  className = '',
  style,
  'data-point-events': dataPointEvents,
  src,
  poster,
  w,
  minW,
  maxW,
  h,
  minH,
  maxH,
  rootW,
  rootH,
  grow,
  r,
  tlr,
  trr,
  brr,
  blr,
  borderTLR,
  borderTRR,
  borderBRR,
  borderBLR,
  aspectRatio,
  objectFit,
  objectPosition,
  bg,
  linkState,
  perspective3d,
  parallax,
  showPlayButton = false,
  controls = false,
  autoPlay = false,
  muted = false,
  playsInline = true,
  loop,
  preload,
  onPlay,
  onPause,
  onEnded,
  ...props
}: WithRef<VideoProps, HTMLVideoElement>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const bgClasses = c.literal('bg', bg);
  const hasBgClass = Boolean(bgClasses[0]);
  const sizeProps = {
    w,
    minW,
    maxW,
    h,
    minH,
    maxH,
  };
  const wrapperSizeProps = {
    w: rootW ?? sizeProps.w,
    minW: sizeProps.minW,
    maxW: sizeProps.maxW,
    h: rootH ?? sizeProps.h,
    minH: sizeProps.minH,
    maxH: sizeProps.maxH,
  };
  const radiusProps = resolveRadiusInput({ r, tlr, trr, brr, blr, borderTLR, borderTRR, borderBRR, borderBLR });
  const { rootProps, elementProps } = splitRootDomProps(props as VideoElementProps);
  const resolvedSrc = resolveMediaSource(src);
  const resolvedPoster = resolveMediaSource(poster);
  const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });

  const [objectFitResolved] = resolveResponsive(objectFit ?? 'cover');
  const [objectPositionResolved] = resolveResponsive(objectPosition ?? 'center');

  useEffect(() => {
    const node = videoRef.current;

    setIsPlaying(node ? !node.paused && !node.ended : autoPlay && Boolean(resolvedSrc));
  }, [autoPlay, resolvedSrc]);

  const setVideoRef = useMergedRefs(videoRef, ref);

  const setRootRef = useCallback((node: HTMLSpanElement | null) => {
    setMotionNode(node);
  }, [setMotionNode]);

  const handlePlayButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!resolvedSrc) return;

    videoRef.current?.play().catch(() => null);
  };

  const handlePlay = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsPlaying(true);
    onPlay?.(event);
  };

  const handlePause = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsPlaying(false);
    onPause?.(event);
  };

  const handleEnded = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setIsPlaying(false);
    onEnded?.(event);
  };

  return (
    <span
      ref={setRootRef}
      data-point-events={dataPointEvents}
      {...(rootProps as React.HTMLAttributes<HTMLSpanElement>)}
      {...stateLinkProps(linkState, { ...motionHandlers })}
      className={cx(
        styles.VideoRoot,
        ...sizeClasses(c, wrapperSizeProps),
        ...radiusClasses(c, radiusProps),
        ...bgClasses,
        needsInlineAspectRatio(aspectRatio) && inlineAspectRatioClassName(),
        needsInlineGrow(grow) && inlineGrowClassName(),
        className
      )}
      style={{
        ...(bg && !hasBgClass ? { background: bg } : null),
        ...sizeInlineStyle({
          ...wrapperSizeProps,
          w: wrapperSizeProps.w ?? '100%',
          h: wrapperSizeProps.h ?? '100%',
        }),
        ...aspectRatioStyle(aspectRatio),
        ...growStyle(grow),
        ...(motionStyle ?? null),
        ...(objectFitResolved ? ({ '--video-fit': objectFitResolved } as CSSProperties) : null),
        ...(objectPositionResolved ? ({ '--video-position': objectPositionResolved } as CSSProperties) : null),
        ...style,
      }}
    >
      {showPlayButton && resolvedSrc && !isPlaying ? (
        <button
          type="button"
          className={styles.VideoPlayButton}
          aria-label="Запустить видео"
          onClick={handlePlayButtonClick}
        >
          <span className={styles.VideoPlayButtonIcon} aria-hidden="true">▶</span>
        </button>
      ) : null}

      <video
        ref={setVideoRef}
        className={styles.Video}
        src={resolvedSrc}
        poster={resolvedPoster}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        playsInline={playsInline}
        loop={loop}
        preload={preload}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={handleEnded}
        {...elementProps}
      />
    </span>
  );
}

export default Video;

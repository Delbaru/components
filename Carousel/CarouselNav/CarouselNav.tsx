'use client';

import styles from './CarouselNav.module.scss';

import { useNearestCarouselControls } from '../../Carousel/controls';
import { Flex } from '../../Flex';
import { Icon } from '../../Icon';
import { cx } from '../../core';

export interface CarouselNavProps {
    className?: string;
    carouselId?: string;
}

export function CarouselNav({ className, carouselId }: CarouselNavProps) {
    const { setRootRef, snapshot } = useNearestCarouselControls(carouselId);
    const shouldRender = snapshot.showNavigation && snapshot.slideCount > 1;
    const prevDisabled = snapshot.navigationState.prevDisabled;
    const nextDisabled = snapshot.navigationState.nextDisabled;

    return (
        <Flex
            ref={setRootRef}
            dir={['row', 'row', null]}
            align={['center', 'center', null]}
            justify={['end', null, null]}
            gap={[8, 4, null]}
            className={cx(styles.CarouselNav, className)}
            data-carousel-navigation
        >
            {shouldRender ? (
                <>
                    <Icon
                        src="./ui/arrows/arrow_gold.svg"
                        w={[70, 36, null]}
                        h={[40, 20, null]}
                        rootW={[132, 68, null]}
                        rootH={[80, 36, null]}
                        rootBg='var(--black-70)'
                        rootR={[40, 40, null]}
                        onClick={() => snapshot.api?.prev()}
                        aria-disabled={prevDisabled}
                        state={prevDisabled ? 'disabled' : undefined}
                        rootClassName={cx(styles.nav, styles.prev)}
                        aria-label="Предыдущий слайд"
                        data-carousel-nav-button="prev"
                    />

                    <Icon
                        src="./ui/arrows/arrow_gold.svg"
                        w={[70, 36, null]}
                        h={[40, 20, null]}
                        rootW={[132, 68, null]}
                        rootH={[80, 36, null]}
                        rootBg='var(--black-70)'
                        rootR={[40, 40, null]}
                        onClick={() => snapshot.api?.next()}
                        aria-disabled={nextDisabled}
                        state={nextDisabled ? 'disabled' : undefined}
                        rootClassName={cx(styles.nav, styles.next)}
                        aria-label="Следующий слайд"
                        data-carousel-nav-button="next"
                    />
                </>
            ) : null}
        </Flex>
    );
}
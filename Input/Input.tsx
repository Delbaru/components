'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import type React from 'react';
import styles from './Input.module.scss';
import { Skeleton } from '../Skeleton';
import { cx, createLayoutClasses, inlineGrowClassName, growStyle, needsInlineGrow, stateProps, stateLinkProps, tokenStyles, fieldLayoutStyles, resolveFieldLayoutClassResolution, fieldHelperPaddingLeft, type BorderStyleProps, type ComponentStateValue, type StateLinkInput, type LayoutSpaceProps, type RadiusPropsShort, type SizePropsShort, type ResponsiveValue, type GrowProps } from '../core';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { Flex } from '../Flex';
import { Calendar } from './Calendar/Calendar';
import { TimeField } from './TimeField/TimeField';
import { useInputBehavior } from './lib/use-input-behavior';
import { DEFAULT_PHONE_FORMAT, maskGroups, type PhoneFormat } from './lib/phone-mask';
import { Tooltip } from '../Tooltip';
import { useSharedMotion, type SharedMotionProps } from '../hooks/useSharedMotion';
import { useTextOverflow } from '../hooks/useTextOverflow';
import { useTooltip } from '../hooks/useTooltip';
import type { WithRef } from '../core';

type VariantKey = 'primary' | 'secondary';
type SizeKey = 'default' | 'fullWidth';
// Типографика поля ввода по токену дизайн-системы (--font-*). По умолчанию поле — `p`.
type FontKey = 'h1' | 'h2' | 'h3' | 'subtitle' | 'title' | 'p' | 'small' | 'dop';

const c = createLayoutClasses([styles, tokenStyles]);

export interface InputProps
    extends Omit<
        React.InputHTMLAttributes<HTMLInputElement>,
        'color' | 'placeholder' | 'size' | 'width' | 'minWidth' | 'maxWidth' | 'height' | 'minHeight' | 'maxHeight'
    >,
    LayoutSpaceProps,
    RadiusPropsShort,
    BorderStyleProps,
    GrowProps,
    SharedMotionProps,
    SizePropsShort {
    style?: CSSProperties;

    variant?: ResponsiveValue<VariantKey>;
    size?: ResponsiveValue<SizeKey>;
    // Типографика поля (--font-*). Не задан → дефолт поля (p).
    font?: FontKey;

    bg?: string;
    color?: string;

    placeholder?: string;
    placeholderColor?: string;
    label?: string;
    labelColor?: string;
    comment?: string;
    showNumberControls?: boolean;
    numberOptions?: number[];
    /**
     * Показать в поле пароля кнопку-глаз, открывающую набранное. ОПТ-ИН, а не поведение по
     * умолчанию у `type='password'`: формы приложения живут без неё, и включить её всем разом
     * значило бы поменять вид чужих экранов заодно с этим. Просят её там, где пароль ПРИДУМЫВАЮТ
     * (регистрация, сброс) — там опечатку иначе не поймать, потому и нарисована она в макете входа.
     */
    revealable?: boolean;
    /**
     * Значение ещё грузится — вместо него бежит скелетон.
     *
     * ОДИН проп на всю механику ожидания: рамка, высота, паддинг и подпись поля остаются на
     * месте, меняется только содержимое ячейки. Ветки «показывать ли поле» на call-site
     * поэтому не нужно — а именно она и расползалась бы по экранам копиями.
     */
    loading?: boolean;

    length?: { min?: number; max?: number };
    /**
     * Формат номера у `type='tel'`: код страны, длина, группы и образец для подсказки.
     *
     * Нужен там, где рядом с полем стоит выбор страны: без него поле обещает «+7» и десять цифр
     * какой бы флаг ни выбрали. Не задан — российский формат, как было.
     */
    phone?: PhoneFormat;
    type?: React.HTMLInputTypeAttribute;

    error?: string;

    state?: ComponentStateValue;

    // Класс на РЯД поля (.input) — тот элемент, который реально красится (фон/рамка/радиус).
    // Нужен пресетам-обёрткам (SharedInput), чтобы вешать классы-оси из _axes.scss: обычный
    // className уезжает на wrapper, а он включает label/comment и красить его нельзя.
    rowClassName?: string;

    required?: boolean;
    emptyMessage?: string;
    validate?: (value: string) => string | undefined;
    /**
     * Где рисовать ошибку поля.
     *
     * `inside` (по умолчанию) — слоем ПОВЕРХ значения: так набран весь кабинет, там поля стоят
     * плотными рядами и лишняя строка двигала бы таблицу. Значение при этом гаснет, а на фокусе
     * ошибка уходит, чтобы не мешать правке.
     *
     * `below` — строкой ПОД полем, значение остаётся видимым. Опт-ин, а не общий дефолт: это
     * меняет высоту поля, то есть вид каждого экрана, где оно стоит. Просят его там, где человек
     * набирает ДЛИННОЕ значение и должен видеть, что именно он написал: «ошибка закрывает поле
     * ввода, и я не вижу, как я писал» — дословная претензия по форме обратной связи сайта.
     */
    errorPlacement?: 'inside' | 'below';

    linkState?: StateLinkInput;
    'data-point-events'?: string;
}

export function Input({
    ref,
    className = '',
    style,
    variant,
    size,
    font,
    p,
    pt,
    pr,
    pb,
    pl,
    m,
    mt,
    mr,
    mb,
    ml,
    r,
    tlr,
    trr,
    brr,
    blr,
    borderTLR,
    borderTRR,
    borderBRR,
    borderBLR,
    border,
    borderC,
    borderS,
    borderW,
    borderT,
    borderR,
    borderB,
    borderL,
    grow,
    perspective3d,
    parallax,
    w,
    minW,
    maxW,
    h,
    minH,
    maxH,
    bg,
    color,
    placeholder,
    placeholderColor,
    label,
    labelColor,
    comment,
    showNumberControls = true,
    revealable = false,
    loading = false,
    numberOptions,
    length,
    phone: phoneFormat = DEFAULT_PHONE_FORMAT,
    type: typeProp,
    value: valueProp,
    defaultValue: defaultValueProp,
    error,
    id: idProp,
    disabled,
    onChange,
    onFocus,
    onBlur,
    onKeyDown: onInputKeyDown,
    required,
    emptyMessage,
    validate: validateProp,
    errorPlacement = 'inside',
    state,
    linkState,
    rowClassName,
    'data-point-events': dataPointEvents,
    ...rest
}: WithRef<InputProps, HTMLInputElement>) {
    const {
        id,
        innerRef,
        inputType,
        isPhone,
        isTime,
        isDate,
        isNumber,
        isReadOnly,
        hasError,
        helperText,
        rootRef,
        isFieldActive,
        hasValue,
        inputProps,
        handleFieldClick,
        handleNumberStep,
        timeField,
        datePicker,
    } = useInputBehavior({
        ref,
        typeProp,
        valueProp,
        defaultValueProp,
        error,
        idProp,
        disabled,
        onChange,
        onFocus,
        onBlur,
        onInputKeyDown,
        required,
        emptyMessage,
        validateProp,
        comment,
        placeholder,
        length,
        numberOptions,
        phoneFormat,
        restInputProps: rest,
    });

    const commentId = !hasError && helperText ? `${id}-comment` : undefined;
    const inlineErrorId = hasError ? `${id}-error` : undefined;
    const helperTextId = inlineErrorId ?? commentId;
    const inputDescribedBy = [inputProps['aria-describedby'], helperTextId].filter(Boolean).join(' ') || undefined;
    const errorBelow = errorPlacement === 'below';
    // Слой поверх значения — только у `inside`. Он же гасит себя на фокусе: значение под ним
    // не видно, и правки вслепую быть не должно. У `below` этой развилки нет вовсе — строка
    // стоит рядом со значением и на фокусе остаётся, потому что она и есть объяснение правки.
    const inlineError = !errorBelow && hasError && !isFieldActive ? helperText : undefined;
    const belowError = errorBelow && hasError ? helperText : undefined;
    const commentText = !hasError ? helperText : undefined;
    // Последний непустой текст ошибки. Содержимое сворачиваемого блока живёт до конца анимации,
    // а `belowError` обнуляется вместе с условием, которое блок прячет, — без этого строка
    // уезжала бы вниз уже ПУСТОЙ (§12 «Появление и исчезновение»).
    const lastBelowError = useRef('');
    if (belowError) lastBelowError.current = belowError;

    // Показ пароля — МЕСТНОЕ состояние поля: это стадия просмотра, а не факт о данных, и в
    // сторе ему делать нечего (перезагрузи страницу — пароль снова скрыт, и так и надо).
    const [revealed, setRevealed] = useState(false);
    const showReveal = revealable && inputType === 'password';

    const { motionHandlers, motionStyle, setMotionNode } = useSharedMotion({ perspective3d, parallax });
    const dateAnchorRef = useRef<HTMLElement | null>(null);
    const setWrapperRef = useCallback((node: HTMLElement | null) => {
        rootRef.current = node;
        setMotionNode(node);
    }, [setMotionNode]);

    // Тултип с полным значением, когда текст не влезает в поле и обрезается «…».
    // Логика тултипа общая (useTooltip → Button/Icon/Input), здесь только гейтим её обрезкой текста.
    const overflow = useTextOverflow<HTMLInputElement>();
    const isOverflowTooltipEnabled = overflow.isOverflowing && !isFieldActive && inputType !== 'password';
    const overflowTooltip = useTooltip<HTMLElement, HTMLDivElement>({
        enabled: isOverflowTooltipEnabled,
        direction: 'bottom',
        align: 'center',
        gap: 8,
    });
    const setFieldRowRef = useCallback((node: HTMLElement | null) => {
        dateAnchorRef.current = node;
        overflowTooltip.anchorRef.current = node;
    }, [overflowTooltip.anchorRef]);
    const setFieldRef = useCallback((node: HTMLInputElement | null) => {
        // innerRef из useFieldControl типизирован как RefObject (readonly current); React сам пишет в .current,
        // здесь мёржим вручную — каст к мутабельному ref'у безопасен.
        (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        overflow.ref.current = node;
    }, [innerRef, overflow.ref]);
    // Нажатие по «обёртке» поля (паддинги, префикс «+7»), а не по самому инпуту, не должно
    // забирать у него фокус: иначе на mousedown происходит blur → валидация помечает поле
    // ошибкой и на миг показывается оверлей ошибки, который исчезает на mouseup. Фокус ставим
    // сами в onClick (handleFieldClick), поэтому здесь просто гасим нативное снятие фокуса.
    const handleFieldMouseDown = useCallback((event: React.MouseEvent<HTMLElement>) => {
        if (event.target !== innerRef.current) {
            event.preventDefault();
        }
    }, [innerRef]);

    const hasExplicitSize = w !== undefined || minW !== undefined || maxW !== undefined || h !== undefined || minH !== undefined || maxH !== undefined;
    const resolvedVariant = variant ?? 'primary';
    const resolvedSize = size ?? (hasExplicitSize ? undefined : 'default');

    const layoutProps = {
        variant: resolvedVariant, size: resolvedSize,
        p, pt, pr, pb, pl, m, mt, mr, mb, ml,
        r, tlr, trr, brr, blr,
        borderTLR, borderTRR, borderBRR, borderBLR,
        border, borderC, borderS, borderW, borderT, borderR, borderB, borderL,
        w, minW, maxW, h, minH, maxH,
        bg, color, placeholderColor,
    };
    const fieldLayoutResolution = resolveFieldLayoutClassResolution(c, layoutProps);
    const typeClassName = inputType || undefined;
    // Класс кегля садится на РЯД, а не на `<input>`: его читают ещё маска телефона и префикс
    // «+7», а они полю не потомки, а соседи (см. `--field-font` в модуле).
    const fieldClassName = styles.field;
    const fontClassName = font ? styles[`font_${font}`] : undefined;

    return (
        <Flex
            ref={setWrapperRef}
            dir={['column', 'column', 'column']}
            gap={[8, 8, 8]}
            className={cx(styles.wrapper, needsInlineGrow(grow) && inlineGrowClassName(), typeClassName, styles[inputType], className)}
            style={{ ...growStyle(grow), ...(motionStyle ?? null), ...style }}
            data-point-events={dataPointEvents}
            {...stateProps(isFieldActive && 'active')}
            {...stateLinkProps(linkState, { ...motionHandlers })}
        >
            {label && (
                <Flex dir={['row', 'row', 'row']} gap={[4, null, null]}>
                    <Text variant={['small', 'small', 'small']} color={labelColor}>{label}</Text>
                    {required && ( <Text variant={['small', 'small', 'small']} color="var(--red)">*</Text> )}
                </Flex>
            )}
            <Flex
                ref={setFieldRowRef}
                dir={['row', 'row', 'row']}
                align={['center', 'center', 'center']}
                className={cx(styles.input, fontClassName, ...fieldLayoutResolution.classes, rowClassName)}
                style={fieldLayoutStyles(layoutProps, fieldLayoutResolution.styleSkips)}
                {...stateProps(state, hasError && 'error', isFieldActive && 'active', hasValue && 'filled', isReadOnly && 'readonly')}
                data-phone-prefix={isPhone || undefined}
                data-inline-error={inlineError ? 'true' : undefined}
                onMouseDown={handleFieldMouseDown}
                onClick={handleFieldClick}
                onMouseEnter={overflowTooltip.show}
                onMouseLeave={overflowTooltip.hide}
            >
                {isPhone && (
                    // Префикс стоит В ПОТОКЕ ряда, а не абсолютом: так он центрируется тем же
                    // `align-items: center`, что и всё остальное, а поле начинается сразу за
                    // ним — без магического отступа, который приходилось держать в двух местах
                    // и который разъезжался, стоило смениться кеглю или масштабу темы.
                    // Кегль не навязываем: его задаёт ряд (`--field-font`).
                    <Text
                        variant={['inherit', 'inherit', 'inherit']}
                        color='var(--primary)'
                        className={styles.phonePrefix}
                    >
                        {phoneFormat.dial}
                    </Text>
                )}

                <div className={styles.fieldSlot}>
                    {/* Значение ещё едет — вместо него полоса скелетона. Она стоит ВНУТРИ
                        ячейки поля, а не вместо всего ряда: рамка, высота, паддинг и подпись
                        остаются на месте, поэтому на приезде данных экран не прыгает — ради
                        этого скелетон и нужен. Реальный `<input>` при этом не рендерится
                        вовсе: поле, в которое можно печатать, пока значение не приехало,
                        потеряет набранное на первом же ответе.

                        Подмена одного другим ЕДЕТ, а не щёлкает: это `transitionKey` — ровно
                        тот ответ, который §8.4 даёт для «узел подменяется другим узлом на том
                        же месте». Раньше здесь стояло голое условие, и скелетон исчезал
                        кадром — пользователь так и сказал: «пропадает не плавно».
                        Перемонтирования `<input>` бояться нечего: своп случается один раз,
                        когда данные приехали, а до этого поля в дереве нет вовсе — то есть
                        отнимать фокус не у кого (в отличие от слоя ошибки, где `transitionKey`
                        запрещён по этой самой причине, см. §12).
                        `w='100%'` обязателен: обёртка свопа — это `Flex`, а у него ребёнок
                        считается по контенту, и без ширины поле сжалось бы по своей надписи
                        (§12 «Обёртка, вставленная РАДИ АНИМАЦИИ, меняет ось раскладки»).
                        СКАЛЯРОМ, а не `['100%', null, null]`: ширина одна на всех ширинах, а
                        кортеж печатал класс только десктопу — ниже 1024 `<input>` сжимался по
                        набранному тексту внутри полноразмерной пилюли (§12). */}
                    <Flex
                        transitionKey={loading ? 'skeleton' : 'value'}
                        animation='fadeIn'
                        w='100%'
                    >
                    {loading ? (
                        <Skeleton h={[16, null, null]} />
                    ) : (
                    <>
                    {/* Маска телефона рисуется УЗЛАМИ, а не нативным `::placeholder`: в макете
                        её части разного цвета и веса (скобки и тире чёрные полужирные, группы
                        цифр серые Regular с разрядкой), а `::placeholder` — одна строка и
                        покрасить её по частям нечем. Слой лежит поверх пустого поля и клики
                        пропускает, поэтому фокус и каретка — по-прежнему у `<input>`. */}
                    {isPhone && !hasValue && (
                        <span aria-hidden className={styles.phoneMask}>
                            {maskGroups(phoneFormat).map((group, groupIndex) => (
                                <span key={groupIndex} className={styles.phoneMaskGroup}>
                                    {group.map((part, partIndex) => (
                                        <span key={partIndex} className={part.dim ? styles.phoneMaskDim : undefined}>
                                            {part.text}
                                        </span>
                                    ))}
                                </span>
                            ))}
                        </span>
                    )}
                    {isTime ? (
                        <TimeField
                            inputRef={innerRef}
                            inputProps={{ ...inputProps, 'aria-describedby': inputDescribedBy }}
                            fieldClassName={fieldClassName}
                            showMask={inlineError ? false : timeField.showMask}
                            maskValue={timeField.value}
                            maskSuffix={timeField.suffix}
                        />
                    ) : (
                        <input
                            ref={setFieldRef}
                            className={fieldClassName}
                            {...inputProps}
                            // ПОСЛЕ спреда: `inputProps` несёт свой `type`, и переопределять
                            // его надо здесь — иначе показ пароля молча не сработает (§12 про
                            // пропы, которые атом выставляет после спреда).
                            type={showReveal && revealed ? 'text' : inputProps.type}
                            // У телефона нативный плейсхолдер гасим: его рисует слой-маска
                            // выше, иначе обе строки наложились бы друг на друга.
                            placeholder={isPhone ? '' : inputProps.placeholder}
                            aria-describedby={inputDescribedBy}
                        />
                    )}
                    </>
                    )}
                    </Flex>
                    {/* Ошибка ПОЯВЛЯЕТСЯ от состояния, значит обязана ехать (§8.4). Из трёх
                        ответов подходит только фейд обёртки: `collapse` тут не при чём (слой
                        абсолютный, высоты не занимает), а `transitionKey` на ячейке перемонтировал
                        бы сам `<input>` — то есть отнял бы у человека фокус и каретку ровно на
                        blur'е. Уход ошибки ведёт гашение самого слоя вместе с возвратом цвета
                        значения (см. модуль). */}
                    {inlineError && (
                        <Flex className={styles.inlineError} animation='fadeIn'>
                            <Text
                                as='div'
                                id={inlineErrorId}
                                role='alert'
                                variant={['p', 'p', 'p']}
                                color='var(--red)'
                                className={styles.inlineErrorText}
                            >
                                {inlineError}
                            </Text>
                        </Flex>
                    )}
                </div>
                {showReveal && (
                    <Icon
                        // Пара из ОДНОЙ семьи и одной техники (обе заливные): разная техника
                        // дала бы разную толщину в одном и том же боксе. Смена картинки —
                        // `animate='swap'`, то есть морф, а не подмена кадром (§8.6).
                        src={revealed ? '/icons/ui/eye/style-1/gaze-away.svg' : '/icons/ui/eye/style-1/eye.svg'}
                        animate='swap'
                        // Скаляром, а не `[24, null, null]`: ниже 1024 кортеж не печатает
                        // класса вовсе, и глаз схлопывался в точку. В макете окна входа он
                        // там 20, но 24 — общий размер значка поля, и разница в четыре
                        // единицы не стоит второй оси у атома.
                        rootW={24}
                        rootH={24}
                        w={24}
                        h={24}
                        rootClassName={styles.passwordToggle}
                        role='button'
                        tabIndex={0}
                        aria-label={revealed ? 'Скрыть пароль' : 'Показать пароль'}
                        data-input-action='true'
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => setRevealed((current) => !current)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;

                            // Пробелу нужен preventDefault, иначе он прокрутит страницу.
                            event.preventDefault();
                            setRevealed((current) => !current);
                        }}
                    />
                )}
                {isDate && (
                    <Icon
                        src='/icons/ui/calendar/style-1/calendar.svg'
                        rootW={[48, null, null]}
                        rootH={[48, null, null]}
                        w={[24, null, null]}
                        h={[24, null, null]}
                        rootR={[16, null, null]}
                        rootBg='var(--background)'
                        rootClassName={styles.dateToggle}
                        data-input-action='true'
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={datePicker.onToggle}
                    />
                )}
                {isNumber && showNumberControls && (
                    <Flex
                        dir={['column', 'column', 'column']}
                        align={['center', 'center', 'center']}
                        gap={[4, null, null]}
                        className={styles.numberArrows}
                    >
                        <Icon
                            src='/icons/ui/arrows/style-3/arrow.svg'
                            rootW={[12, null, null]}
                            rootH={[8, null, null]}
                            w={[16, null, null]}
                            h={['auto', null, null]}
                            rootClassName={cx(styles.btn, styles.up)}
                            data-input-action='true'
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleNumberStep(1)}
                        />
                        <Icon
                            src='/icons/ui/arrows/style-3/arrow.svg'
                            rootW={[12, null, null]}
                            rootH={[8, null, null]}
                            w={[16, null, null]}
                            h={['auto', null, null]}
                            rootClassName={cx(styles.btn, styles.down)}
                            data-input-action='true'
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleNumberStep(-1)}
                        />
                    </Flex>
                )}
            </Flex>
            {/* Ошибка СТРОКОЙ под полем. Условие тут — статичный проп, а не состояние: набор
                узлов от действий человека не меняется, поэтому анимировать сам этот `&&` нечего
                (§8.4 «не каждое `? (` требует свопа»). Едет РАСКРЫТИЕ строки: `collapse` по
                высоте, зазор — в `collapseGap`, то есть внутри той же анимации. */}
            {errorBelow && (
                <Flex
                    collapse={Boolean(belowError)}
                    collapseGap={[8, null, null]}
                    collapseFade
                    className={styles.belowError}
                >
                    <Text
                        as='div'
                        id={inlineErrorId}
                        role='alert'
                        variant={['small', 'small', 'small']}
                        color='var(--red)'
                    >
                        {belowError ?? lastBelowError.current}
                    </Text>
                </Flex>
            )}
            {overflow.isOverflowing && (
                <Tooltip ref={overflowTooltip.tooltipRef} {...overflowTooltip.bubbleProps}>
                    {overflow.text}
                </Tooltip>
            )}
            {isDate && (
                <Calendar
                    id={id}
                    anchorRef={dateAnchorRef}
                    floatingRef={datePicker.floatingRef}
                    isActive={datePicker.isActive}
                    visibleMonth={datePicker.visibleMonth}
                    setVisibleMonth={datePicker.setVisibleMonth}
                    selectedDate={datePicker.selectedDate}
                    calendarDays={datePicker.calendarDays}
                        isDateDisabled={datePicker.isDateDisabled}
                    onDateSelect={datePicker.onDateSelect}
                />
            )}
            {commentText && (
                <Text
                    as='div'
                    id={commentId}
                    variant={['small', 'small', 'small']}
                    color='var(--gray)'
                    pl={fieldHelperPaddingLeft(layoutProps.p, layoutProps.pl)}
                >
                    {commentText}
                </Text>
            )}
        </Flex>

    );
}

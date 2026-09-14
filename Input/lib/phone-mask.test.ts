import assert from 'node:assert/strict';
import test from 'node:test';

import {
    emptyValue,
    extractDigits,
    formatPhone,
    isEmpty,
    maskGroups,
    placeholderText,
    stripPrefix,
    validate,
    type PhoneFormat,
} from './phone-mask';

// Контролируемое поле: то, что маска отдала наружу, возвращается ей же следующим рендером.
// Именно на этом круге и ломалось — регрессия ловится только round-trip'ом, а не одним вызовом.
const roundTrip = (store: string, typed: string, format?: PhoneFormat) =>
    formatPhone(stripPrefix(formatPhone(store, format), format) + typed, format);

test('набор слева направо не доклеивает семёрки из собственного префикса', () => {
    let store = '';

    for (const digit of '9161234567') {
        store = roundTrip(store, digit);
    }

    assert.equal(store, '+7 (916) 123 - 45 - 67');
});

test('каждая промежуточная цифра держится ровно на своём месте', () => {
    const steps = ['+7 (9', '+7 (91', '+7 (916', '+7 (916) 1', '+7 (916) 12', '+7 (916) 123'];
    let store = '';

    steps.forEach((expected, index) => {
        store = roundTrip(store, '916123'.charAt(index));
        assert.equal(store, expected);
    });
});

test('стирание справа налево убирает по одной цифре и доходит до пустого', () => {
    let store = '+7 (916) 123 - 45 - 67';
    const seen: string[] = [];

    for (let step = 0; step < 10; step += 1) {
        store = formatPhone(stripPrefix(formatPhone(store)).slice(0, -1));
        seen.push(extractDigits(store));
    }

    assert.deepEqual(seen, ['916123456', '91612345', '9161234', '916123', '91612', '9161', '916', '91', '9', '']);
    assert.equal(store, emptyValue());
    assert.ok(isEmpty(store));
});

test('код страны отбрасывается только у полного номера (автозаполнение браузера)', () => {
    assert.equal(formatPhone('+79161234567'), '+7 (916) 123 - 45 - 67');
    assert.equal(formatPhone('89161234567'), '+7 (916) 123 - 45 - 67');
    assert.equal(formatPhone('79161234567'), '+7 (916) 123 - 45 - 67');
    // Локальные 10 цифр, начинающиеся с 7/8, — это НЕ код страны: первую цифру не теряем.
    assert.equal(extractDigits('7999123456'), '7999123456');
    assert.equal(extractDigits('8999123456'), '8999123456');
});

test('мусор и лишние цифры отбрасываются', () => {
    assert.equal(formatPhone('916abc123'), '+7 (916) 123');
    assert.equal(formatPhone('9161234567890'), '+7 (916) 123 - 45 - 67');
    assert.equal(formatPhone(''), emptyValue());
});

test('проверка ругается только на НЕполный номер', () => {
    assert.equal(validate(''), undefined);
    assert.equal(validate('+7 (916) 123 - 45 - 67'), undefined);
    assert.ok(validate('+7 (916) 123'));
});

// ─── Формат другой страны ─────────────────────────────────────────────────────────────────────

const BY: PhoneFormat = { dial: '+375', digits: 9, groups: [2, 3, 2, 2], sample: '291234567' };

test('чужой формат ведёт СВОЙ префикс, длину и группы', () => {
    let store = '';

    for (const digit of '291234567') {
        store = roundTrip(store, digit, BY);
    }

    assert.equal(store, '+375 (29) 123 - 45 - 67');
    assert.equal(stripPrefix(store, BY), '(29) 123 - 45 - 67');
    assert.equal(emptyValue(BY), '+375 ');
    assert.equal(placeholderText(BY), '(29) 123 - 45 - 67');
});

test('чужой код страны из автозаполнения снимается по СВОЕМУ формату', () => {
    assert.equal(formatPhone('+375291234567', BY), '+375 (29) 123 - 45 - 67');
    assert.equal(formatPhone('375291234567', BY), '+375 (29) 123 - 45 - 67');
    // Девять цифр — уже национальный номер: первую не теряем, даже если она совпала с кодом.
    assert.equal(extractDigits('375123456', BY), '375123456');
    // Российская «восьмёрка» к чужой стране не применяется.
    assert.equal(extractDigits('8291234567', BY), '829123456');
});

test('длина проверяется по формату, а сообщение считает вместе с кодом', () => {
    assert.equal(validate('+375 (29) 123 - 45 - 67', BY), undefined);
    assert.equal(validate('+375 (29) 123', BY), 'Введите 12 цифр номера');
    assert.equal(validate('+7 (916) 123'), 'Введите 11 цифр номера');
});

// ─── Страна, формата которой мы не знаем ──────────────────────────────────────────────────────

const UNKNOWN: PhoneFormat = { dial: '+220' };

test('без известного формата длина свободная, а групп и подсказки нет вовсе', () => {
    assert.equal(formatPhone('7123456', UNKNOWN), '+220 7123456');
    assert.equal(validate('+220 7123456', UNKNOWN), undefined);
    // Слишком короткое — «номер не дописан» верно для любой страны.
    assert.ok(validate('+220 71', UNKNOWN));
    assert.deepEqual(maskGroups(UNKNOWN), []);
    assert.equal(placeholderText(UNKNOWN), '');
    // Потолок — E.164: пятнадцать цифр вместе с кодом страны.
    assert.equal(extractDigits('1234567890123456789', UNKNOWN).length, 12);
});

test('карта подсказки собирается из образца и групп', () => {
    assert.deepEqual(maskGroups(), [
        [{ text: '(' }, { text: '999', dim: true }, { text: ')' }],
        [{ text: '123', dim: true }],
        [{ text: '–' }],
        [{ text: '45', dim: true }],
        [{ text: '–' }],
        [{ text: '67', dim: true }],
    ]);
    assert.equal(placeholderText(), '(999) 123 - 45 - 67');
});

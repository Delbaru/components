import NameIcon from './assets/user-linear.svg';
import TitleIcon from './assets/file-text-outline.svg';
import QuestionsIcon from './assets/questions.svg';
import TimeIcon from './assets/clock-circle-outline.svg';
import DateIcon from './assets/calendar-minimalistic-outline.svg';
import SkipIcon from './assets/skip-next-outline.svg';
import ReturnIcon from './assets/arrow-to-down-right-linear.svg';
import RetakeIcon from './assets/refresh-bold.svg';
import ResultIcon from './assets/chart-linear.svg';

export type RichTextareaVariableKey =
  | 'name'
  | 'title'
  | 'questions'
  | 'time'
  | 'date'
  | 'skip'
  | 'return'
  | 'retake'
  | 'result'
  | 'attempts'
  | 'lk'
  | 'login'
  | 'password';

export type RichTextareaVariableMeta = {
  key: RichTextareaVariableKey;
  label: string;
  description: string;
  icon: string;
  aliases?: string[];
};

export function normalizeSvgAssetPath(path: string) {
  if (!path) {
    return path;
  }

  if (/^(https?:)?\/\//i.test(path) || path.startsWith('data:') || path.startsWith('/')) {
    return path;
  }

  return `/${path.replace(/^\.\//, '')}`;
}

export function resolveSvgAssetSource(asset: unknown) {
  if (typeof asset === 'string') {
    return normalizeSvgAssetPath(asset);
  }

  if (asset && typeof asset === 'object' && 'src' in asset && typeof (asset as { src?: unknown }).src === 'string') {
    return normalizeSvgAssetPath((asset as { src: string }).src);
  }

  return undefined;
}

const variableMetaEntries: RichTextareaVariableMeta[] = [
  { key: 'name', label: 'Имя', description: 'ФИО ученика', icon: resolveSvgAssetSource(NameIcon) ?? '' },
  {
    key: 'title',
    label: 'Название',
    aliases: ['Название'],
    description: 'Название теста',
    icon: resolveSvgAssetSource(TitleIcon) ?? '',
  },
  {
    key: 'questions',
    label: 'Вопросы',
    aliases: ['Вопросы'],
    description: 'Количество вопросов',
    icon: resolveSvgAssetSource(QuestionsIcon) ?? '',
  },
  {
    key: 'time',
    label: 'Время',
    aliases: ['Время'],
    description: 'Время на прохождение',
    icon: resolveSvgAssetSource(TimeIcon) ?? '',
  },
  {
    key: 'date',
    label: 'Дата',
    aliases: ['Дата'],
    description: 'Дата прохождения',
    icon: resolveSvgAssetSource(DateIcon) ?? '',
  },
  { key: 'skip', label: 'Пропуск', description: 'Возможность пропуска', icon: resolveSvgAssetSource(SkipIcon) ?? '' },
  { key: 'return', label: 'Возврат', description: 'Можно возвращаться к вопросам', icon: resolveSvgAssetSource(ReturnIcon) ?? '' },
  { key: 'retake', label: 'Пересдача', description: 'Доступность пересдачи', icon: resolveSvgAssetSource(RetakeIcon) ?? '' },
];

export const richTextareaVariableMetaByKey = Object.fromEntries(
  variableMetaEntries.map((entry) => [entry.key, entry])
) as Record<RichTextareaVariableKey, RichTextareaVariableMeta>;

export const richTextareaVariableOptions = variableMetaEntries;

export interface TextSlideOptions {
  steps?: string[];
  currentStep?: number;
  duration?: number;
  lineHeight?: string;
  hoverColor?: string;
  /** 'swap' — слайд-своп значения при его смене (старое уезжает вверх, новое въезжает снизу). */
  mode?: 'swap';
}

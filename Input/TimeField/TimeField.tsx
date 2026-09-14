'use client';

import type React from 'react';

import { cx } from '../../core';
import styles from './TimeField.module.scss';

interface TimeFieldProps {
  inputRef: React.Ref<HTMLInputElement>;
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;
  fieldClassName: string;
  showMask: boolean;
  maskValue: string;
  maskSuffix: string;
}

export function TimeField({
  inputRef,
  inputProps,
  fieldClassName,
  showMask,
  maskValue,
  maskSuffix,
}: TimeFieldProps) {
  return (
    <div className={styles.root}>
      {showMask && maskSuffix && (
        <input
          className={cx(fieldClassName, styles.mask)}
          aria-hidden='true'
          tabIndex={-1}
          readOnly
          value={`${maskValue}${maskSuffix}`}
        />
      )}
      <input ref={inputRef} className={cx(fieldClassName, showMask && styles.fieldMasked)} {...inputProps} />
    </div>
  );
}

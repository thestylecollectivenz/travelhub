import * as React from 'react';
import { RichTextEditor } from '../journal/RichTextEditor';
import { plainTextToEditorHtml } from '../../utils/journalRichText';
import styles from './RichTextField.module.css';

export interface RichTextFieldProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  minHeight?: string;
  className?: string;
  labelClassName?: string;
  fullRow?: boolean;
}

/** Notes / long-form field with journal-grade formatting toolbar. */
export const RichTextField: React.FC<RichTextFieldProps> = ({
  id,
  label,
  value,
  onChange,
  disabled,
  minHeight = '6rem',
  className,
  labelClassName,
  fullRow
}) => {
  const html = React.useMemo(() => plainTextToEditorHtml(value), [value]);

  return (
    <div className={`${styles.root} ${fullRow ? styles.fullRow : ''} ${className ?? ''}`}>
      {label ? (
        <label className={labelClassName ?? styles.label} htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className={`${styles.editorWrap} ${fullRow ? styles.editorFullRow : ''}`} id={id}>
        <RichTextEditor value={html} onChange={onChange} disabled={disabled} minHeight={minHeight} />
      </div>
    </div>
  );
};

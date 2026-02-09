import { useCallback } from 'react';

interface FormattingOptions {
  selectionStart: number;
  selectionEnd: number;
  value: string;
}

interface FormattingResult {
  value: string;
  cursorPosition: number;
  selectionLength: number;
}

/**
 * Markdown格式化Hook
 * 提供各种Markdown语法插入功能
 * 修复光标位置计算问题
 */
export function useMarkdownFormatting() {
  const insertFormatting = useCallback((options: FormattingOptions, syntax: string, placeholder = ''): FormattingResult => {
    const { selectionStart, selectionEnd, value } = options;
    const beforeSelection = value.substring(0, selectionStart);
    const selectedText = value.substring(selectionStart, selectionEnd);
    const afterSelection = value.substring(selectionEnd);

    const hasSelection = selectionEnd > selectionStart;
    const isEmptySelection = !hasSelection;

    let newValue: string;
    let cursorPosition: number;
    let selectionLength: number;

    switch (syntax) {
      case 'bold':
        if (isEmptySelection) {
          // 没有选中文本，光标在两个**之间
          newValue = `${beforeSelection}**${afterSelection}`;
          cursorPosition = beforeSelection.length + 2;
          selectionLength = 0;
        } else {
          // 选中了文本，包裹在**之间
          newValue = `${beforeSelection}**${selectedText}**${afterSelection}`;
          // 光标应该定位在文本内容中间，而不是后面
          cursorPosition = beforeSelection.length + 2;
          selectionLength = selectedText.length;
        }
        break;

      case 'italic':
        if (isEmptySelection) {
          // 使用*而不是_避免与Token系统冲突
          newValue = `${beforeSelection}*${afterSelection}`;
          cursorPosition = beforeSelection.length + 1;
          selectionLength = 0;
        } else {
          newValue = `${beforeSelection}*${selectedText}*${afterSelection}`;
          // 光标定位在文本内容中间
          cursorPosition = beforeSelection.length + 1;
          selectionLength = selectedText.length;
        }
        break;

      case 'strikethrough':
        if (isEmptySelection) {
          newValue = `${beforeSelection}~~${afterSelection}`;
          cursorPosition = beforeSelection.length + 2;
          selectionLength = 0;
        } else {
          newValue = `${beforeSelection}~~${selectedText}~~${afterSelection}`;
          // 光标定位在文本内容中间
          cursorPosition = beforeSelection.length + 2;
          selectionLength = selectedText.length;
        }
        break;

      case 'underline':
        // 标准Markdown不支持下划线，使用HTML标签
        if (isEmptySelection) {
          newValue = `${beforeSelection}<u></u>${afterSelection}`;
          cursorPosition = beforeSelection.length + 3;
          selectionLength = 0;
        } else {
          newValue = `${beforeSelection}<u>${selectedText}</u>${afterSelection}`;
          cursorPosition = beforeSelection.length + 3;
          selectionLength = selectedText.length;
        }
        break;

      case 'code':
        if (isEmptySelection) {
          newValue = `${beforeSelection}\`${afterSelection}`;
          cursorPosition = beforeSelection.length + 1;
          selectionLength = 0;
        } else {
          newValue = `${beforeSelection}\`${selectedText}\`${afterSelection}`;
          cursorPosition = beforeSelection.length + 1 + selectedText.length;
          selectionLength = 0;
        }
        break;

      case 'codeblock':
        // 代码块特殊处理
        if (isEmptySelection) {
          newValue = `${beforeSelection}\n\`\`\`${placeholder || 'language'}\n\n\`\`\`\n${afterSelection}`;
          cursorPosition = beforeSelection.length + 4 + (placeholder || 'language').length + 1;
          selectionLength = 0;
        } else {
          newValue = `${beforeSelection}\n\`\`\`${placeholder || 'language'}\n${selectedText}\n\`\`\`\n${afterSelection}`;
          cursorPosition = beforeSelection.length + 4 + (placeholder || 'language').length + 1 + selectedText.length;
          selectionLength = 0;
        }
        break;

      case 'link':
        if (isEmptySelection) {
          newValue = `${beforeSelection}[](https://)${afterSelection}`;
          cursorPosition = beforeSelection.length + 1;
          selectionLength = 0;
        } else {
          newValue = `${beforeSelection}[${selectedText}](https://)${afterSelection}`;
          cursorPosition = beforeSelection.length + 1 + selectedText.length + 3;
          selectionLength = 0;
        }
        break;

      case 'image':
        if (isEmptySelection) {
          newValue = `${beforeSelection}![](https://)${afterSelection}`;
          cursorPosition = beforeSelection.length + 2;
          selectionLength = 0;
        } else {
          newValue = `${beforeSelection}![${selectedText}](https://)${afterSelection}`;
          cursorPosition = beforeSelection.length + 2 + selectedText.length + 3;
          selectionLength = 0;
        }
        break;

      case 'quote':
        if (isEmptySelection) {
          newValue = `${beforeSelection}> ${afterSelection}`;
          cursorPosition = beforeSelection.length + 2;
          selectionLength = 0;
        } else {
          // 每行前面添加>
          const lines = selectedText.split('\n');
          const quotedLines = lines.map(line => `> ${line}`).join('\n');
          newValue = `${beforeSelection}${quotedLines}${afterSelection}`;
          cursorPosition = beforeSelection.length + quotedLines.length;
          selectionLength = 0;
        }
        break;

      case 'heading1':
        if (isEmptySelection) {
          newValue = `${beforeSelection}# ${afterSelection}`;
          cursorPosition = beforeSelection.length + 2;
          selectionLength = 0;
        } else {
          const lines = selectedText.split('\n');
          const headingLines = lines.map(line => `# ${line}`).join('\n');
          newValue = `${beforeSelection}${headingLines}${afterSelection}`;
          cursorPosition = beforeSelection.length + headingLines.length;
          selectionLength = 0;
        }
        break;

      case 'heading2':
        if (isEmptySelection) {
          newValue = `${beforeSelection}## ${afterSelection}`;
          cursorPosition = beforeSelection.length + 3;
          selectionLength = 0;
        } else {
          const lines = selectedText.split('\n');
          const headingLines = lines.map(line => `## ${line}`).join('\n');
          newValue = `${beforeSelection}${headingLines}${afterSelection}`;
          cursorPosition = beforeSelection.length + headingLines.length;
          selectionLength = 0;
        }
        break;

      case 'heading3':
        if (isEmptySelection) {
          newValue = `${beforeSelection}### ${afterSelection}`;
          cursorPosition = beforeSelection.length + 4;
          selectionLength = 0;
        } else {
          const lines = selectedText.split('\n');
          const headingLines = lines.map(line => `### ${line}`).join('\n');
          newValue = `${beforeSelection}${headingLines}${afterSelection}`;
          cursorPosition = beforeSelection.length + headingLines.length;
          selectionLength = 0;
        }
        break;

      case 'ul':
        if (isEmptySelection) {
          newValue = `${beforeSelection}- ${afterSelection}`;
          cursorPosition = beforeSelection.length + 2;
          selectionLength = 0;
        } else {
          const lines = selectedText.split('\n');
          const listLines = lines.map(line => `- ${line}`).join('\n');
          newValue = `${beforeSelection}${listLines}${afterSelection}`;
          cursorPosition = beforeSelection.length + listLines.length;
          selectionLength = 0;
        }
        break;

      case 'ol':
        if (isEmptySelection) {
          newValue = `${beforeSelection}1. ${afterSelection}`;
          cursorPosition = beforeSelection.length + 3;
          selectionLength = 0;
        } else {
          const lines = selectedText.split('\n');
          const listLines = lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
          newValue = `${beforeSelection}${listLines}${afterSelection}`;
          cursorPosition = beforeSelection.length + listLines.length;
          selectionLength = 0;
        }
        break;

      case 'task':
        if (isEmptySelection) {
          newValue = `${beforeSelection}- [ ] ${afterSelection}`;
          cursorPosition = beforeSelection.length + 5;
          selectionLength = 0;
        } else {
          const lines = selectedText.split('\n');
          const taskLines = lines.map(line => `- [ ] ${line}`).join('\n');
          newValue = `${beforeSelection}${taskLines}${afterSelection}`;
          cursorPosition = beforeSelection.length + taskLines.length;
          selectionLength = 0;
        }
        break;

      case 'table':
        if (isEmptySelection) {
          newValue = `${beforeSelection}| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |${afterSelection}`;
          cursorPosition = beforeSelection.length + 11;
          selectionLength = 0;
        } else {
          newValue = `${beforeSelection}${selectedText}${afterSelection}`;
          cursorPosition = beforeSelection.length + selectedText.length;
          selectionLength = 0;
        }
        break;

      case 'hr':
        newValue = `${beforeSelection}\n---\n${afterSelection}`;
        cursorPosition = beforeSelection.length + 4;
        selectionLength = 0;
        break;

      default:
        return { value, cursorPosition: selectionStart, selectionLength: 0 };
    }

    return { value: newValue, cursorPosition, selectionLength };
  }, []);

  /**
   * 插入Token格式@提及
   */
  const insertMention = useCallback((options: FormattingOptions, userId: string, displayName: string): FormattingResult => {
    const { selectionStart, selectionEnd, value } = options;
    const beforeSelection = value.substring(0, selectionStart);
    const afterSelection = value.substring(selectionEnd);

    const mention = `@{${userId}:${displayName}}`;
    const newValue = `${beforeSelection}${mention}${afterSelection}`;
    const cursorPosition = beforeSelection.length + mention.length;

    return { value: newValue, cursorPosition, selectionLength: 0 };
  }, []);

  /**
   * 格式化快捷键处理
   */
  const handleShortcut = useCallback((
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    options: FormattingOptions
  ): boolean => {
    const { key, ctrlKey, metaKey, shiftKey } = e;

    // 组合键
    if ((ctrlKey || metaKey) && !shiftKey) {
      switch (key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          return insertFormatting(options, 'bold').value !== options.value;

        case 'i':
          e.preventDefault();
          return insertFormatting(options, 'italic').value !== options.value;

        case 'k':
          e.preventDefault();
          return insertFormatting(options, 'link').value !== options.value;

        case 'e':
          e.preventDefault();
          return insertFormatting(options, 'code').value !== options.value;
      }
    }

    // Ctrl+Shift+字母
    if ((ctrlKey || metaKey) && shiftKey) {
      switch (key.toLowerCase()) {
        case 'c':
          e.preventDefault();
          return insertFormatting(options, 'codeblock', 'javascript').value !== options.value;

        case 'q':
          e.preventDefault();
          return insertFormatting(options, 'quote').value !== options.value;

        case 'h':
          e.preventDefault();
          return insertFormatting(options, 'heading1').value !== options.value;

        case 'l':
          e.preventDefault();
          return insertFormatting(options, 'ul').value !== options.value;
      }
    }

    return false;
  }, [insertFormatting]);

  return {
    insertFormatting,
    insertMention,
    handleShortcut,
  };
}

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.resolve(__dirname, '../src');

// Regexes to detect common bare strings
const REGEXES = [
  // 1. JSX text nodes between tags: >Text<
  {
    name: 'JSX text node between tags',
    regex: /(?<!=)>([^<{}]+)</g,
    captureGroup: 1,
    validate: (str) => /[a-zA-Z\u4e00-\u9fa5]/.test(str) && !str.trim().startsWith('//')
  },
  // 2. JSX text node before a curly brace: >Text {
  {
    name: 'JSX text node before expression',
    regex: /(?<!=)>([^<{]+)\{/g,
    captureGroup: 1,
    validate: (str) => /[a-zA-Z\u4e00-\u9fa5]/.test(str) && !str.trim().startsWith('//')
  },
  // 3. JSX text node after a curly brace: } Text <
  {
    name: 'JSX text node after expression',
    regex: /\}([a-zA-Z\u4e00-\u9fa5\s,.\-!?'"()]+)</g,
    captureGroup: 1,
    validate: (str) => /[a-zA-Z\u4e00-\u9fa5]/.test(str)
  },
  // 4. JSX attribute string literals (e.g. placeholder, title, alt, label, etc.)
  {
    name: 'JSX bare attribute value',
    regex: /\b(placeholder|title|alt|label|aria-label)="([^"{}]+)"/g,
    captureGroup: 2,
    validate: (str) => /[a-zA-Z\u4e00-\u9fa5]/.test(str) && !str.startsWith('{')
  },
  // 5. JavaScript bare alert/toast/confirm/throw error messages
  {
    name: 'Bare string in alert/toast/confirm/error',
    regex: /\b(alert|toast|confirm|showError|showSuccess|throw\s+new\s+Error)\(\s*["']([^"']+)["']/g,
    captureGroup: 2,
    validate: (str) => /[a-zA-Z\u4e00-\u9fa5]/.test(str)
  }
];

// List of keywords and patterns that signify code lines rather than JSX text
const CODE_EXCLUDE_PATTERNS = [
  /=>/,
  /\b(const|let|var|function|import|export|class|interface|type|return)\b/,
  /===/,
  /!==/,
  /&&/,
  /\|\|/,
  /\b(onChange|onClick|onSubmit|onKeyDown|onFocus|onBlur)\b/,
  /\b(useState|useEffect|useRef|useContext|useTranslation|useAuth|useNavigate|useLocation)\b/,
  /Promise<[^>]+>/,
  /^[a-zA-Z0-9_\-]+$/, // Single words / keys
  /\bv\d+\.\d+\b/        // Version strings like v2.4
];

function shouldIgnoreLine(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('import ') || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return true;
  }
  return CODE_EXCLUDE_PATTERNS.some(pattern => pattern.test(line));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    
    if (shouldIgnoreLine(line)) {
      return;
    }

    REGEXES.forEach(({ name, regex, captureGroup, validate }) => {
      // Reset regex index for safety
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(line)) !== null) {
        const value = match[captureGroup];
        if (value && validate(value.trim())) {
          const trimmedValue = value.trim();
          // Filter out false positives like SVG path data, CSS units, or purely symbols
          if (
            trimmedValue.length > 1 &&
            !trimmedValue.includes('px') && 
            !trimmedValue.includes('rem') &&
            !/^[a-zA-Z0-9_\-]+$/.test(trimmedValue) && // Ignore single-word keys/identifiers
            !trimmedValue.startsWith('d="') &&
            !trimmedValue.startsWith('M ') &&
            !trimmedValue.startsWith('http')
          ) {
            findings.push({
              lineNumber,
              lineContent: line.trim(),
              type: name,
              value: trimmedValue
            });
          }
        }
      }
    });
  });

  return findings;
}

function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, fileList);
    } else if (filePath.endsWith('.tsx') && !filePath.endsWith('.test.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

function main() {
  console.log('Scanning front_end/src/ for bare strings...');
  const files = walkDir(SRC_DIR);
  let totalIssues = 0;

  files.forEach(file => {
    const relativePath = path.relative(path.resolve(__dirname, '..'), file);
    // Ignore files in the i18n localization setup folder
    if (relativePath.includes('i18n')) {
      return;
    }
    const fileFindings = scanFile(file);
    if (fileFindings.length > 0) {
      console.log(`\n\x1b[33m[BARE STRINGS FOUND] in ${relativePath}:\x1b[0m`);
      fileFindings.forEach(f => {
        console.log(`  Line ${f.lineNumber}: [${f.type}] -> "${f.value}"`);
        console.log(`    Code: \x1b[90m${f.lineContent}\x1b[0m`);
        totalIssues++;
      });
    }
  });

  console.log('\n----------------------------------------');
  if (totalIssues > 0) {
    console.log(`\x1b[31mScan failed. Found ${totalIssues} bare string(s) that should be localized using t().\x1b[0m`);
    process.exit(1);
  } else {
    console.log('\x1b[32mScan passed! No bare strings found.\x1b[0m');
    process.exit(0);
  }
}

main();

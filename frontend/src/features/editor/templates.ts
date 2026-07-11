import type { EditorLanguage } from '@/features/editor/types';

export const CODE_TEMPLATES: Record<EditorLanguage, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {

    return 0;
}
`,
  python: `def main():
    pass

if __name__ == "__main__":
    main()
`,
};

export function getTemplate(language: EditorLanguage): string {
  return CODE_TEMPLATES[language];
}

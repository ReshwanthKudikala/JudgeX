export interface ProblemEditorial {
  title: string;
  markdown: string;
  updatedAt: string;
}

export interface EditorialAdmin extends ProblemEditorial {
  id: string;
  problemId: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdBy: string | null;
  published: boolean;
  createdAt: string;
}

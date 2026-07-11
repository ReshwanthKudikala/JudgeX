import { useParams } from 'react-router-dom';

import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton, SkeletonText } from '@/components/common/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

export function ProblemDetailPage() {
  const { problemId } = useParams();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-white">Problem details</h1>
        <Badge variant="medium">Placeholder</Badge>
      </div>
      <p className="text-sm text-muted">
        Problem ID: <span className="font-mono text-muted-foreground">{problemId}</span>
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-2/3" />
            </CardTitle>
            <CardDescription>Statement, examples, and constraints arrive next.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="description">
              <TabsList>
                <TabsTrigger value="description">Description</TabsTrigger>
                <TabsTrigger value="submissions">Submissions</TabsTrigger>
              </TabsList>
              <TabsContent value="description">
                <SkeletonText lines={6} />
              </TabsContent>
              <TabsContent value="submissions">
                <p className="text-sm text-muted">Submission history will appear here.</p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Editor</CardTitle>
            <CardDescription>
              Monaco is installed as a dependency but not wired up in this sprint.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-md border border-dashed border-border bg-background font-mono text-sm text-muted">
              Code editor placeholder
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

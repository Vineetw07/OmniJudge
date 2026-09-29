import { redirect } from 'next/navigation';

/**
 * Redirect /projects/new to /projects with submit modal open or direct to gallery
 */
export default function NewProjectPage() {
  redirect('/projects');
}

'use client';
import { useParams } from 'next/navigation';

export default function BranchDetailTest() {
  const { id } = useParams() as { id: string };
  return <h1>Branch Detail Test: {id}</h1>;
}

import { Fragment } from 'react';
import { ChevronRight, Network } from 'lucide-react';
import { blockPresentation } from '@/block-presentation';
import type { BlockData } from '@/model';
type IdentityData = Pick<BlockData, 'kind' | 'recipe' | 'operation'>;
export function BlockIcon({ data }: { data: IdentityData }) {
  const identity = blockPresentation(data);
  return identity.network ? <Network/> : <>{identity.symbol}</>;
}
export function BlockTrail({ data }: { data: IdentityData }) {
  return <>{blockPresentation(data).trail.map((part, index) => <Fragment key={index}>{index > 0 && <ChevronRight aria-hidden="true"/>}<span>{part}</span></Fragment>)}</>;
}

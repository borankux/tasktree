import { useProjectStore } from '../store/projectStore';
import type { NodeStatus, NodePriority, NodeType } from '@tasktree/shared';

const priorityFilters: { value: NodePriority; label: string; color: string }[] = [
  { value: 'p0', label: 'P0', color: 'bg-red-500' },
  { value: 'p1', label: 'P1', color: 'bg-orange-500' },
  { value: 'p2', label: 'P2', color: 'bg-gray-500' },
  { value: 'p3', label: 'P3', color: 'bg-gray-700' },
];

const statusFilters: { value: NodeStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-500' },
  { value: 'active', label: 'Active', color: 'bg-yellow-500' },
  { value: 'done', label: 'Done', color: 'bg-green-500' },
  { value: 'dropped', label: 'Dropped', color: 'bg-red-500' },
];

const typeFilters: { value: NodeType; label: string }[] = [
  { value: 'task', label: 'Task' },
  { value: 'milestone', label: 'Milestone' },
  { value: 'group', label: 'Group' },
  { value: 'decision', label: 'Decision' },
  { value: 'note', label: 'Note' },
];

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

export default function FilterBar() {
  const filterPriority = useProjectStore((s) => s.filterPriority);
  const setFilterPriority = useProjectStore((s) => s.setFilterPriority);
  const filterStatus = useProjectStore((s) => s.filterStatus);
  const setFilterStatus = useProjectStore((s) => s.setFilterStatus);
  const filterType = useProjectStore((s) => s.filterType);
  const setFilterType = useProjectStore((s) => s.setFilterType);

  const hasFilters = filterPriority.length > 0 || filterStatus.length > 0 || filterType.length > 0;

  const toggleFilter = (current: string[], set: (v: string[]) => void, value: string) => {
    if (current.includes(value)) {
      set(current.filter((v) => v !== value));
    } else {
      set([...current, value]);
    }
  };

  if (!hasFilters) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span>Filter:</span>
        {priorityFilters.map((f) => (
          <FilterChip key={f.value} active={false} onClick={() => toggleFilter(filterPriority, setFilterPriority, f.value)}>
            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${f.color}`} />
            {f.label}
          </FilterChip>
        ))}
        <span className="text-gray-700">|</span>
        {statusFilters.map((f) => (
          <FilterChip key={f.value} active={false} onClick={() => toggleFilter(filterStatus, setFilterStatus, f.value)}>
            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${f.color}`} />
            {f.label}
          </FilterChip>
        ))}
        <span className="text-gray-700">|</span>
        {typeFilters.map((f) => (
          <FilterChip key={f.value} active={false} onClick={() => toggleFilter(filterType, setFilterType, f.value)}>
            {f.label}
          </FilterChip>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span>Filter:</span>
      {priorityFilters.map((f) => (
        <FilterChip key={f.value} active={filterPriority.includes(f.value)} onClick={() => toggleFilter(filterPriority, setFilterPriority, f.value)}>
          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${f.color}`} />
          {f.label}
        </FilterChip>
      ))}
      <span className="text-gray-700">|</span>
      {statusFilters.map((f) => (
        <FilterChip key={f.value} active={filterStatus.includes(f.value)} onClick={() => toggleFilter(filterStatus, setFilterStatus, f.value)}>
          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${f.color}`} />
          {f.label}
        </FilterChip>
      ))}
      <span className="text-gray-700">|</span>
      {typeFilters.map((f) => (
        <FilterChip key={f.value} active={filterType.includes(f.value)} onClick={() => toggleFilter(filterType, setFilterType, f.value)}>
          {f.label}
        </FilterChip>
      ))}
      <button
        onClick={() => { setFilterPriority([]); setFilterStatus([]); setFilterType([]); }}
        className="ml-2 text-gray-500 hover:text-white"
      >
        Clear
      </button>
    </div>
  );
}

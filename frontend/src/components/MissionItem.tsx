interface MissionItemProps {
  title: string;
  members: string[];
}

export function MissionItem({ title, members }: MissionItemProps) {
  return (
    <div>
      <div>{title}</div>
      <div>{members.join(', ')}</div>
    </div>
  );
}
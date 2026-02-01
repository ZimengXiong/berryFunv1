interface CapacityIndicatorProps {
  capacity: number;
  enrolled: number;
}

export function CapacityIndicator({ capacity, enrolled }: CapacityIndicatorProps) {
  const percentage = (enrolled / capacity) * 100;
  const remaining = capacity - enrolled;

  let colorClass = "bg-green-500";
  if (percentage >= 90) {
    colorClass = "bg-red-500";
  } else if (percentage >= 70) {
    colorClass = "bg-orange-500";
  } else if (percentage >= 50) {
    colorClass = "bg-yellow-500";
  }

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">Capacity</span>
        <span className="font-medium">
          {remaining === 0 ? (
            <span className="text-red-600">Full</span>
          ) : (
            <span>{remaining} spots left</span>
          )}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className={`${colorClass} h-2 rounded-full transition-all duration-300`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        ></div>
      </div>
      <div className="text-xs text-gray-500 mt-1 text-right">
        {enrolled} / {capacity} enrolled
      </div>
    </div>
  );
}

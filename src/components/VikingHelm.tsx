/** Viking helmet logo in lucide stroke style (currentColor, round caps). */
export function VikingHelm({
  size = 24,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {/* heavy swept horns */}
      <path strokeWidth={2.2} d="M5.9 12.2C4.2 10.4 3.3 8 3.5 5.1c2.2 1 4.2 3.1 4.7 5.6" />
      <path strokeWidth={2.2} d="M18.1 12.2c1.7-1.8 2.6-4.2 2.4-7.1-2.2 1-4.2 3.1-4.7 5.6" />
      {/* dome with top spike */}
      <path d="M4.8 14.6a7.2 7.2 0 0 1 14.4 0" />
      <path strokeWidth={2} d="M12 7.2V4.6" />
      {/* brow band */}
      <path strokeWidth={2.3} d="M4.2 15.9h15.6" />
      {/* cheek guards + nasal */}
      <path d="M7.6 15.9v2.5M16.4 15.9v2.5" />
      <path d="M10.8 15.9v4.2h2.4v-4.2" />
    </svg>
  )
}

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ')
}

export default function SurfaceCard({
  as: Component = 'section',
  className = '',
  children,
  padded = true,
  tone = 'default',
  ...props
}) {
  return (
    <Component
      className={joinClassNames(
        'surface-card',
        padded ? 'surface-card--padded' : '',
        tone !== 'default' ? `surface-card--${tone}` : '',
        className
      )}
      {...props}
    >
      {children}
    </Component>
  )
}

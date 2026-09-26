import { Children, cloneElement, isValidElement, useId } from 'react'

export default function AdminField({ label, hint, children, horizontal = false }) {
  const id = useId()
  return <div className={horizontal ? 'grid grid-cols-1 sm:grid-cols-3 gap-3 items-start' : 'flex flex-col gap-1.5 min-w-0'}>
    <div className={horizontal ? 'sm:pt-2.5' : undefined}>
      <label htmlFor={id} className="text-xs font-mono text-muted">{label}</label>
      {hint && <p className="text-xs text-subtle mt-0.5">{hint}</p>}
    </div>
    <div className={horizontal ? 'sm:col-span-2 min-w-0' : 'min-w-0'}>
      {Children.map(children, (child) => isValidElement(child) && ['input', 'textarea', 'select'].includes(child.type) ? cloneElement(child, { id }) : child)}
    </div>
  </div>
}

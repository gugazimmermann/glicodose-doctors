type BrandLogoProps = {
  size?: number
  className?: string
}

export function BrandLogo({ size = 40, className = '' }: BrandLogoProps) {
  return (
    <img
      src="/glucosemeter.png"
      alt="GlicoDose"
      width={size}
      height={size}
      className={`rounded-xl object-contain ${className}`}
      decoding="async"
    />
  )
}

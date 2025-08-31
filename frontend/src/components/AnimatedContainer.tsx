import React, { useEffect, useRef, useState } from 'react';

interface AnimatedContainerProps {
  children: React.ReactNode;
  animation?: 'fadeInUp' | 'slideInLeft' | 'slideInRight' | 'scaleIn' | 'bounce';
  delay?: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

const AnimatedContainer: React.FC<AnimatedContainerProps> = ({
  children,
  animation = 'fadeInUp',
  delay = 0,
  duration = 0.6,
  className = '',
  style = {}
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true);
          }, delay * 1000);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [delay]);

  const animationStyle: React.CSSProperties = {
    opacity: isVisible ? 1 : 0,
    transform: getTransform(animation, isVisible),
    transition: `all ${duration}s cubic-bezier(0.4, 0, 0.2, 1)`,
    ...style
  };

  return (
    <div ref={ref} className={className} style={animationStyle}>
      {children}
    </div>
  );
};

const getTransform = (animation: string, isVisible: boolean): string => {
  if (isVisible) return 'none';
  
  switch (animation) {
    case 'fadeInUp':
      return 'translateY(30px)';
    case 'slideInLeft':
      return 'translateX(-30px)';
    case 'slideInRight':
      return 'translateX(30px)';
    case 'scaleIn':
      return 'scale(0.9)';
    case 'bounce':
      return 'translateY(-10px)';
    default:
      return 'translateY(30px)';
  }
};

export default AnimatedContainer;
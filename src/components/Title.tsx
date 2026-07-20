interface TitleProps {
  title: string;
}

const Title = ({ title }: TitleProps) => {
  return (
    <h1 className="uppercase font-extrabold mb-6 text-center text-3xl md:text-4xl tracking-wide bg-linear-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
      {title}
    </h1>
  );
};

export default Title;

export default (props: {
  name: string;
  children?: React.ReactNode;
}) => {
  return (
    <div>
      App, {props.name}
      {props.children}
    </div>
  );
};

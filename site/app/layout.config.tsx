import { type HomeLayoutProps } from "fumadocs-ui/home-layout";
import { BookOpenIcon, FlaskConicalIcon, ExternalLinkIcon } from "lucide-react";

export const baseOptions: HomeLayoutProps = {
  nav: {
    title: "tonal-guitar",
  },
  links: [
    {
      text: "Docs",
      icon: <BookOpenIcon />,
      url: "/docs",
    },
    {
      text: "Guitar Lab",
      icon: <FlaskConicalIcon />,
      url: "/experiments",
    },
    {
      text: "Repository",
      icon: <ExternalLinkIcon />,
      url: "https://github.com/coryleistikow/tonal-guitar",
    },
  ],
};

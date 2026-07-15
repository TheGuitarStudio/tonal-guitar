import { type HomeLayoutProps } from "fumadocs-ui/home-layout";
import {
  BookOpenIcon,
  FlaskConicalIcon,
  ExternalLinkIcon,
  LayoutGridIcon,
} from "lucide-react";

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
      text: "Shapes",
      icon: <LayoutGridIcon />,
      url: "/shapes",
    },
    {
      text: "Repository",
      icon: <ExternalLinkIcon />,
      url: "https://github.com/TheGuitarStudio/tonal-guitar",
    },
  ],
};

import "../../components/information-pages.css";
import { InformationLayout } from "../../components/information-layout";

export default function InfoLayout({ children }: { children: React.ReactNode }) {
  return <InformationLayout>{children}</InformationLayout>;
}

import {
    Form,
    Body,
    ShouldExist,
    ShouldBeNotEmpty,
} from "../../../components/http/validator";

@Form()
export class Create {
    @ShouldBeNotEmpty()
    @ShouldExist()
    @Body()
    folder: string;

    @ShouldBeNotEmpty()
    @ShouldExist()
    @Body()
    content_type: string;

    @ShouldExist()
    @Body()
    private: boolean;
}
var submission_data =  { responses: { } };

const setResponse = (id, value) => {
    submission_data.responses[`q${id}`] = value;
};

$(document).ready(() => {
    var activeQuestionPanel = $('section:first-of-type');

    $('.next-section').click(e => {
        activeQuestionPanel = $(this).parents('section').next();
        console.log("next section is " + activeQuestionPanel.attr("id"));
        $('body').scrollTo(activeQuestionPanel, 1000, { easing: 'easeInOutQuint' });
    });

    $('.prev-section').click(e => {
        activeQuestionPanel = $(this).parents('section').prev();        
        console.log("next section is " + activeQuestionPanel.attr("id"));
        $('body').scrollTo(activeQuestionPanel, 1000, { easing: 'easeInOutQuint' });
    });

    $('#send_survey_response').click(e => {

        $.ajax({
            url: '/vote/ui_test/response',
            type: 'POST',
            data: JSON.stringify(submission_data),
            contentType: "application/json; charset=utf-8",

            success: (data, textStatus, jqXHR) => {
                $('#submissionResponseModalTitle').html("Responses Received!");
                $('#submissionResponseModalMessage').html("That's that, all done! We've received your responses to this survey and they have been stored securely. For security reasons your session will be ended.");
                $('#submissionResponseModal').modal('show');
            },

            error: (jqXHR, textStatus, errorThrown) => {
                $('#submissionResponseModalTitle').html("Something Went Wrong...");

                var errStr = "";
                switch(jqXHR.status) {
                    case 400:
                        errStr = "The response table was incorrectly formed. This likely indicates a bug in the software and should be reported to the r/Pokemon team (400 BAD REQUEST).";
                        break;
                    case 401:
                        errStr = "Our server does not have a record of your session authorisation, indicating you have either already completed this survey or have clicked 'decline' when asked to authorise your account (401 UNAUTHORIZED).";
                        break;
                    case 409:
                        errStr = "The response table was too short, too long, or contained response entries that do not match the required type or format (409 CONFLICT).";
                    default:
                        errStr = "Unknown failure  (" + jqXHR.status + ")";
                        break;
                }

                $('#submissionResponseModalMessage').html(`Unfortunately an issue occured during transmission of your responses: ${errStr}`);
                $('#submissionResponseModal').modal('show');
            }
        })
    });
    
    var resizeTimeout;
    $(window).resize(() => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            $('body').scrollTo(activeQuestionPanel, 0);
        }, 50);
    });
});
